import { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { createModelGateway, LlmError, llmError } from '@anyko/llm';

import type { AnalysisStepInput, DocumentAgents, WorkFacts } from '..';
import { isAppError } from '../../../platform/errors';
import { literalSourceQuote } from '../../../platform/source-quote';
import type { FactSourceText } from '../../../profiles/agent-policy';
import {
  analysisDiscrepancySchema,
  analysisMissingFieldSchema,
} from '../../../profiles/analysis-discrepancy';
import { candidateSchema } from '../../../profiles/candidate';

import {
  analysisProposalsSchema,
  stepwiseAnalysisInstructions,
} from './analysis-policy';
import type { findArbitrationCourt } from './arbitration-court';
import { createWorkContextBudget } from './context-budget';
import {
  createCourtLookupTool,
  reviewCourtCandidates,
} from './court-lookup-tool';
import {
  createCreditorLookup,
  reviewCreditorCandidates,
} from './creditor-lookup-tool';
import type { findCreditor } from './creditor-registry';
import {
  decodeModelFieldValue,
  encodeModelFieldValue,
  modelFields,
} from './model-field-value';
import { createWorkReadTools } from './work-read-tools';

type Candidate = WorkFacts['candidates'][number];

function evidenceBinder(input: AnalysisStepInput) {
  const documents = new Map(
    input.documents.map((source) => [source.id, source]),
  );
  return async (
    entries: Candidate['evidence'],
    sources?: Map<string, FactSourceText>,
  ) => {
    const evidence: Candidate['evidence'] = [];
    for (const entry of entries) {
      input.signal.throwIfAborted();
      await input.assertCurrent();
      const { documentId, imagePath } = entry;
      const document = documents.get(documentId);
      if (
        !document ||
        (imagePath !== null && !document.images.includes(imagePath))
      )
        return { missing: entry };
      const text = await input.readSource(documentId, imagePath);
      const quote = literalSourceQuote(text, entry.quote);
      if (quote === undefined) return { missing: entry };
      if (sources && imagePath === null && typeof text === 'string')
        sources.set(documentId, { documentId, text });
      evidence.push({ ...entry, quote });
    }
    return { evidence };
  };
}

export function createAnalysisStepAgent(options: {
  mastra: Mastra;
  gateway: ReturnType<typeof createModelGateway>;
  lookupCourt: typeof findArbitrationCourt;
  lookupCreditor: typeof findCreditor;
  streamIdleTimeoutMs: number;
  maxModelCalls: number;
  maxReads?: number | undefined;
  reviewMaxReads: number;
}): NonNullable<DocumentAgents['runAnalysisStep']> {
  return async (input) => {
    const { signal, step } = input;
    const trace = options.gateway.trace(
      input.trace,
      input.modelId,
      input.connection,
    );
    try {
      const limits = await options.gateway.contextLimits(
        input.connection,
        input.modelId,
        signal,
      );
      const budget = createWorkContextBudget(limits);
      const available = modelFields(input.fields, input.policy.modelFields);
      const review = input.review;
      const writable = new Set(review?.fields ?? step.fields);
      const fields = available.filter(({ key }) => writable.has(key));
      const bindEvidence = evidenceBinder(input);
      const hasEvidence = async (candidate: Candidate) =>
        !!(await bindEvidence(candidate.evidence)).evidence;
      const read = createWorkReadTools({
        ...input,
        pageCharacters: budget.pageCharacters,
        maxReads: review ? options.reviewMaxReads : options.maxReads,
        ...(review && {
          reserveRead: (limit: number) => review.reserveRead(limit),
        }),
        listSourceMetadata: true,
        encodeValue: encodeModelFieldValue,
      });
      const lookups = review
        ? undefined
        : input.policy.lookups?.steps[step.key];
      const court = createCourtLookupTool({
        ...input,
        fields,
        lookupCourt: options.lookupCourt,
        evidence: lookups?.court,
      });
      const creditor = createCreditorLookup({
        ...input,
        fields,
        lookupCreditor: options.lookupCreditor,
        evidence: lookups?.creditor,
        documents: input.documents,
      });
      const proposeFacts = createTool({
        id: 'propose-facts',
        description:
          'Сохранить кандидатов текущего шага. evidence — массив объектов с documentId, imagePath (null для текста), quote (дословная копия фрагмента) и page, если физическая страница известна. explanation — null для document, для inference объясни вывод. В feedback проверь статус каждого кандидата и осталось ли поле пустым.',
        inputSchema: analysisProposalsSchema(fields),
        execute: async ({ candidates }, { agent }) => {
          if (!agent?.toolCallId) throw new Error('MISSING_TOOL_CALL_ID');
          await input.assertCurrent();
          const accepted: { candidate: Candidate; index: number }[] = [];
          const statuses = [];
          const rejectedEvidence: {
            index: number;
            fragment: Candidate['evidence'][number];
          }[] = [];
          for (const raw of candidates) {
            const { value, explanation, ...proposal } = raw;
            const checked = candidateSchema.safeParse({
              ...proposal,
              value: decodeModelFieldValue(value),
              ...(typeof explanation === 'string' && { explanation }),
            });
            if (!checked.success) {
              statuses.push('invalid_candidate');
              continue;
            }
            const evidenceRule = input.policy.stepEvidence;
            const sources = evidenceRule?.needsSourceText(checked.data)
              ? new Map<string, FactSourceText>()
              : undefined;
            const { evidence, missing } = await bindEvidence(
              checked.data.evidence,
              sources,
            );
            if (!evidence) {
              rejectedEvidence.push({
                index: statuses.length + 1,
                fragment: missing,
              });
              statuses.push('quote_not_found');
              continue;
            }
            const candidate = { ...checked.data, evidence };
            const rejection =
              sources &&
              evidenceRule?.rejection(candidate, [...sources.values()]);
            if (rejection) {
              statuses.push(rejection);
              continue;
            }
            if (
              input.policy.courtInferenceFields?.includes(candidate.field) &&
              candidate.origin === 'inference'
            ) {
              const facts = (await input.currentFacts?.()) ?? input.facts;
              const verified = await reviewCourtCandidates(
                {
                  facts,
                  candidates: [
                    ...input.candidates,
                    ...accepted.map((entry) => entry.candidate),
                  ],
                },
                court,
                [candidate],
                hasEvidence,
              );
              if (
                !verified.some(
                  (item) =>
                    item.field === candidate.field &&
                    item.value === candidate.value,
                )
              ) {
                statuses.push('court_not_verified');
                continue;
              }
              accepted.push(
                ...verified.map((candidate) => ({
                  candidate,
                  index: statuses.length,
                })),
              );
            } else accepted.push({ candidate, index: statuses.length });
            statuses.push('saved');
          }
          const saved = await input.proposeFacts(
            agent.toolCallId,
            accepted,
            statuses,
            candidates.map(({ field }) => field),
          );
          const result = {
            ...saved,
            ...(review && { remainingFields: review.remainingFields() }),
            ...(rejectedEvidence.length && {
              rejectedEvidence,
              guidance:
                'Фрагмент не найден. Перечитай указанный источник. Цитата должна быть дословной копией фрагмента, включая знаки препинания.',
            }),
          };
          await input.traceTool?.({
            input: JSON.stringify({ tool: 'propose-facts', candidates }),
            output: JSON.stringify(result),
            status: 'succeeded',
          });
          return result;
        },
      });
      const recordMissingFields = createTool({
        id: 'record-missing-fields',
        description:
          'Запиши причину по полям, которые всё ещё пусты: not_in_sources — сведений нет в источниках, unreadable_source — источник неразборчив, lawyer_required — поле заполняет юрист.',
        inputSchema: z.strictObject({
          fields: z
            .array(
              analysisMissingFieldSchema.extend({
                field: z.enum(fields.map(({ key }) => key)),
              }),
            )
            .min(1)
            .max(100),
        }),
        execute: async ({ fields }, { agent }) => {
          if (!review || !agent?.toolCallId)
            throw new Error('ANALYSIS_REVIEW_REQUIRED');
          await input.assertCurrent();
          const result = await review.recordReasons(agent.toolCallId, fields);
          await input.traceTool?.({
            input: JSON.stringify({ tool: 'record-missing-fields', fields }),
            output: JSON.stringify(result),
            status: result.includes('saved') ? 'succeeded' : 'failed',
          });
          return result;
        },
      });
      const reportDiscrepancy = createTool({
        id: 'report-discrepancy',
        description:
          'Отметить расхождение для юриста с полями, объяснением и двумя дословными цитатами.',
        inputSchema: analysisDiscrepancySchema,
        execute: async (discrepancy, { agent }) => {
          if (!agent?.toolCallId) throw new Error('MISSING_TOOL_CALL_ID');
          await input.assertCurrent();
          const { evidence } = await bindEvidence(discrepancy.evidence);
          if (
            !evidence ||
            new Set(
              evidence.map(({ documentId, imagePath, quote }) =>
                JSON.stringify([documentId, imagePath, quote]),
              ),
            ).size < 2
          )
            return 'quote_not_found';
          if (
            !discrepancy.fields.every((field) =>
              available.some(({ key }) => key === field),
            )
          )
            return 'field_not_allowed';
          const result = await input.reportDiscrepancy(agent.toolCallId, {
            ...discrepancy,
            evidence,
          });
          await input.traceTool?.({
            input: JSON.stringify({ tool: 'report-discrepancy', discrepancy }),
            output: JSON.stringify(result),
            status: 'succeeded',
          });
          return result;
        },
      });
      const closure = { complete: false };
      const finishReview = createTool({
        id: 'finish-review',
        description:
          'Заверши сверку после того, как у каждого пустого поля есть значение или сохранённая причина.',
        inputSchema: z.strictObject({}),
        execute: async () => {
          if (!review) throw new Error('ANALYSIS_REVIEW_REQUIRED');
          await input.assertCurrent();
          const fields = review.uncoveredFields();
          closure.complete = fields.length === 0;
          const result = closure.complete
            ? { status: 'complete' }
            : {
                status: 'incomplete',
                fields,
                guidance:
                  'Сверка не закрыта. Для каждого указанного поля сохрани значение с цитатой или причину пропуска.',
              };
          await input.traceTool?.({
            input: JSON.stringify({ tool: 'finish-review' }),
            output: JSON.stringify(result),
            status: 'succeeded',
          });
          return result;
        },
      });
      const agent = new Agent({
        id: 'stepwise-work-analysis',
        name: 'Агент работы',
        mastra: options.mastra,
        inputProcessors: [budget.processor],
        model: options.gateway.model(
          input.connection,
          {
            id: input.modelId,
            images: false,
            tools: true,
            structuredOutput: false,
            streamIdleTimeoutMs: options.streamIdleTimeoutMs,
          },
          input.observe,
          trace,
        ),
        tools: {
          ...read.tools,
          ...(review
            ? {
                reportDiscrepancy,
                finishReview,
                ...(fields.length && { proposeFacts, recordMissingFields }),
              }
            : { proposeFacts, ...court.tools, ...creditor.tools }),
        },
        instructions: stepwiseAnalysisInstructions,
      });
      let conversation: Parameters<Agent['stream']>[0] = JSON.stringify({
        sessionId: input.sessionId,
        step: { ...step, fields },
        documents: input.documents.map(({ id, filename, images }) => ({
          id,
          filename,
          hasImages: images.length > 0,
        })),
        previousSummary: input.previousSummary,
        completedSteps: input.completedSteps,
        ...(review && {
          review: {
            fields,
            fieldInstructions: review.fieldInstructions,
            recordedReasons: review.reasons,
            unreadableSources: input.unreadableSources ?? [],
          },
        }),
      });
      let summary = '';
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let reviewLimit: 'model_calls' | 'reads' | undefined;
      for (;;) {
        const remaining =
          options.maxModelCalls - (review?.modelCallsUsed() ?? 0);
        if (remaining <= 0) {
          reviewLimit = 'model_calls';
          break;
        }
        const stream: Awaited<ReturnType<Agent['stream']>> = await agent.stream(
          conversation,
          {
            abortSignal: signal,
            maxSteps: remaining,
            prepareStep: async () => {
              await input.assertCurrent();
              await review?.startModelCall();
            },
            providerOptions: options.gateway.reasoningOptions(
              input.connection,
              input.enableReasoning === false ? 'medium' : 'high',
            ),
            modelSettings: {
              maxOutputTokens: budget.maxOutputTokens,
              maxRetries: 1,
            },
          },
        );
        const result = await stream.getFullOutput();
        budget.assertFits();
        if (result.error) throw result.error;
        if (result.finishReason === 'length')
          throw new LlmError('LLM_COMPLETION_LIMIT');
        if (result.totalUsage.inputTokens !== undefined)
          inputTokens = (inputTokens ?? 0) + result.totalUsage.inputTokens;
        if (result.totalUsage.outputTokens !== undefined)
          outputTokens = (outputTokens ?? 0) + result.totalUsage.outputTokens;
        const text = result.text.trim().slice(0, 2000);
        if (text) summary = text;
        if (!review) {
          if (result.finishReason === 'tool-calls')
            throw new LlmError('LLM_STEP_LIMIT');
          if (result.finishReason !== 'stop')
            throw new LlmError('LLM_INVALID_RESPONSE');
          summary = z.string().min(1).parse(summary);
          break;
        }
        if (read.readLimitExceeded()) {
          reviewLimit = 'reads';
          break;
        }
        const fieldsToCover = review.uncoveredFields();
        if (
          fieldsToCover.length === 0 &&
          (closure.complete || result.finishReason === 'stop')
        )
          break;
        if (
          result.finishReason !== 'stop' &&
          result.finishReason !== 'tool-calls'
        )
          throw new LlmError('LLM_INVALID_RESPONSE');
        if (review.modelCallsUsed() >= options.maxModelCalls) {
          reviewLimit = 'model_calls';
          break;
        }
        conversation = [
          ...result.messages.filter(({ role }) => role !== 'system'),
          {
            role: 'user',
            content: JSON.stringify({
              event: 'review.close_rejected',
              fields: fieldsToCover,
              instruction:
                'Сверка не закрыта. Для каждого указанного поля сохрани значение с цитатой или причину пропуска. Затем вызови finishReview.',
            }),
          },
        ];
      }
      if (!summary)
        summary = reviewLimit
          ? 'Сверка остановлена по лимиту.'
          : 'Сверка завершена.';
      if (creditor.resolve) {
        const facts = (await input.currentFacts?.()) ?? input.facts;
        const verified = await reviewCreditorCandidates(
          { ...input, facts },
          creditor,
          hasEvidence,
        );
        if (verified.candidates.length)
          await input.proposeFacts(
            'verified-creditors',
            verified.candidates.map((candidate) => ({ candidate, index: -1 })),
            [],
            [],
          );
      }
      await trace?.parsed({
        status: 'accepted',
        summary,
        ...(reviewLimit && { reviewLimit }),
      });
      return {
        summary,
        usage: { inputTokens, outputTokens },
        ...(reviewLimit && { reviewLimit }),
      };
    } catch (error) {
      await trace?.failed();
      if (isAppError(error)) throw error;
      throw llmError(error, signal);
    }
  };
}
