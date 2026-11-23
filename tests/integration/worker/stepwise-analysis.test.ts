import { expect, test } from 'bun:test';

import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';

import { createDocumentAgents } from '../../../packages/backend/src/modules/agents/infrastructure/mastra';
import {
  brandFileId,
  brandGenerationId,
} from '../../../packages/backend/src/platform/ids';
import { createBackend } from '../../../packages/backend/src/runtime';
import { completionStream } from '../../../packages/backend/tests/support/completion-stream';
import { memberScope } from '../../../packages/backend/tests/support/scope';

import { integrationConfig } from './support/composition';

const requestSchema = z.object({
  max_tokens: z.number(),
  messages: z.array(z.object({ role: z.string(), content: z.unknown() })),
  tools: z
    .array(
      z.object({
        function: z.object({ name: z.string(), parameters: z.unknown() }),
      }),
    )
    .optional(),
});

test.each([
  { scenario: 'generates three DOCX', exhaustedStep: null },
  {
    scenario: 'retains its first draft at the model call limit',
    exhaustedStep: 'identity',
  },
  {
    scenario: 'publishes completed steps at the model call limit',
    exhaustedStep: 'registration',
  },
  {
    scenario: 'reports the configured read limit during final review',
    exhaustedStep: 'consistency',
  },
  {
    scenario: 'keeps final review incomplete when empty fields have no reason',
    exhaustedStep: 'review-coverage',
  },
  {
    scenario:
      'publishes the partial review when the model reaches its completion ceiling',
    exhaustedStep: 'review-completion',
  },
])(
  'stepwise analysis $scenario',
  async ({ exhaustedStep }) => {
    const completionLimit = exhaustedStep === 'review-completion';
    const incompleteReview =
      exhaustedStep === 'review-coverage' || completionLimit;
    const advertisedLimit =
      exhaustedStep === 'identity'
        ? undefined
        : completionLimit
          ? 64000
          : 131072;
    const limitedStep = incompleteReview ? 'consistency' : exhaustedStep;
    const databaseUrl = z
      .url()
      .refine((url) =>
        /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
      )
      .parse(process.env.TEST_DATABASE_URL);
    const redisUrl = z.url().parse(process.env.TEST_REDIS_URL);
    const pool = createDatabasePool(databaseUrl);
    const db = createDatabase(pool);
    const workspaceId = crypto.randomUUID();
    const scope = memberScope(workspaceId, 'fixture');
    const quote = 'Должник: Примеров Матвей Лабораториевич.';
    const otherQuote = 'Податель заявления: Примеров Матвей Лабораторович.';
    const missingQuote = 'Должник, Примеров Матвей Лабораториевич.';
    const territory = 'Московская область';
    const court = 'Арбитражный суд Московской области';
    const addresses = 'Адрес регистрации: Задонск.';
    const regionQuote = 'Субъект места жительства: Московская область.';
    const districtQuote = 'Район: Задонский район.';
    const cash = 'Наличные денежные средства: 2 300,00 руб.';
    const document = [
      quote,
      otherQuote,
      addresses,
      cash,
      regionQuote,
      districtQuote,
    ].join('\n');
    const steps: string[] = [];
    const systemMessages = new Set<string>();
    let observedDraft = false;
    let observedSource = false;
    let observedQuoteRejection = false;
    let proposedCourt = false;
    let proposedDistrict = false;
    let triedDistrictRewrite = false;
    let recordedReasons = false;
    let finishRequested = false;
    let finishAccepted = false;
    let observedContinuation = false;
    let stoppedBeforeReasons = false;
    let documentId: string | undefined;
    let exhaustedStepCalls = 0;
    const call = (name: string, args: object) => ({
      id: crypto.randomUUID(),
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    });
    const agents = createDocumentAgents({
      pool,
      analysisMaxModelCalls:
        limitedStep && limitedStep !== 'consistency'
          ? 4
          : incompleteReview
            ? 7
            : 12,
      ...(exhaustedStep === 'consistency' && { analysisReviewMaxReads: 1 }),
      ...(exhaustedStep === 'identity' && { analysisMaxReads: 1 }),
      fetchCourtPage: (url) => {
        if (url === 'https://arbitr.ru/ac/map')
          return Promise.resolve(
            Response.json([
              {
                ac1: [
                  {
                    name: court,
                    s_name: 'Московской области',
                    cityname: 'Москва',
                    region_type: 3,
                    url: 'http://asmo.arbitr.ru',
                  },
                ],
              },
            ]),
          );
        expect(url).toBe('https://asmo.arbitr.ru/about/mode');
        return Promise.resolve(
          new Response(
            '<div class="info-page__text"><table><tr><td>Почтовый адрес:</td><td>107053, Москва, пр-кт Академика Сахарова, 18</td></tr></table></div>',
          ),
        );
      },
      fetch: Object.assign(
        async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
          const request = new Request(url, init);
          expect(new URL(request.url).hostname).toBe('fixture.invalid');
          if (!request.url.endsWith('/chat/completions'))
            return Response.json({
              context_length: completionLimit ? 131072 : 262144,
              max_completion_tokens: advertisedLimit,
            });
          const body = requestSchema.parse(await request.json());
          expect(body.max_tokens).toBe(advertisedLimit ?? 64000);
          const userMessages = body.messages.filter(
            ({ role }) => role === 'user',
          );
          const latest = userMessages[0];
          const input = z
            .object({
              step: z.object({ key: z.string(), instructions: z.string() }),
              documents: z.array(z.object({ id: z.uuid() })),
              review: z
                .object({ fields: z.array(z.object({ key: z.string() })) })
                .optional(),
            })
            .parse(JSON.parse(String(latest?.content)));
          const key = input.step.key;
          if (userMessages.length > 1) {
            const continuation = z
              .object({ event: z.string(), fields: z.array(z.string()) })
              .parse(JSON.parse(String(userMessages.at(-1)?.content)));
            expect(continuation.event).toBe('review.close_rejected');
            expect(continuation.fields).toContain('postalCode');
            expect(body.messages.some(({ role }) => role === 'tool')).toBe(
              true,
            );
            observedContinuation = true;
          }
          if (key === limitedStep) exhaustedStepCalls++;
          const start = steps.at(-1) !== key;
          if (start) steps.push(key);
          const system = body.messages.find(({ role }) => role === 'system');
          systemMessages.add(String(system?.content));
          const tools = body.tools?.map(({ function: fn }) => fn.name) ?? [];
          const toolResponse = body.messages
            .filter(({ role }) => role === 'tool')
            .at(-1);
          const resultText = JSON.stringify(toolResponse?.content ?? '');
          const source = input.documents[0]?.id;
          if (!source) throw new Error('EXPECTED_PILOT_SOURCE');
          const evidence = (text: string) => [
            { documentId: source, imagePath: null, quote: text },
          ];
          let toolCall;
          if (start && key === 'identity') {
            expect(input.step.instructions).toContain(
              '«Паспорт гражданина Российской Федерации»',
            );
            expect(input.step.instructions).toContain('origin: document');
            expect(input.step.instructions).toContain('imagePath=null');
            expect(tools).not.toContain('lookupCreditorRegistry');
            const proposal = body.tools?.find(
              ({ function: fn }) => fn.name === 'proposeFacts',
            );
            expect(proposal?.function.parameters).toMatchObject({
              type: 'object',
              properties: {
                candidates: {
                  type: 'array',
                  items: {
                    anyOf: [
                      {
                        properties: {
                          field: {
                            type: 'string',
                            enum: expect.arrayContaining([
                              'middleName',
                              'inn',
                            ]) as unknown,
                          },
                          value: { type: 'string' },
                          evidence: {
                            type: 'array',
                            items: {
                              anyOf: [
                                {
                                  type: 'object',
                                  required: [
                                    'documentId',
                                    'imagePath',
                                    'quote',
                                  ],
                                },
                                {
                                  type: 'object',
                                  required: [
                                    'documentId',
                                    'imagePath',
                                    'quote',
                                    'page',
                                  ],
                                },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            });
            expect(JSON.stringify(proposal?.function.parameters)).not.toContain(
              '"city"',
            );
            toolCall = call('readSource', {
              documentId: source,
              imagePath: null,
              offset: 0,
            });
          } else if (
            key === 'identity' &&
            resultText.includes(quote) &&
            !observedSource
          ) {
            observedSource = true;
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'lastName',
                  value: 'Примеров',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(quote),
                },
                {
                  field: 'firstName',
                  value: 'Матвей',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(quote),
                },
                {
                  field: 'middleName',
                  value: 'Лабораториевич',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(quote),
                },
                {
                  field: 'middleName',
                  value: 'Лабораториевич',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(missingQuote),
                },
              ],
            });
          } else if (key === 'identity') {
            if (resultText.includes('quote_not_found')) {
              expect(resultText).toContain(missingQuote);
              expect(resultText).toContain(
                'Цитата должна быть дословной копией фрагмента',
              );
              observedQuoteRejection = true;
            }
            if (exhaustedStep === 'identity')
              toolCall = call('readField', { field: 'middleName', offset: 0 });
          } else if (start && key === 'obligations') {
            expect(input.step.instructions).toContain(
              '«Кредитный договор» и «Договор потребительского кредита»',
            );
            expect(tools).toContain('lookupCreditorRegistry');
            const proposal = body.tools?.find(
              ({ function: fn }) => fn.name === 'proposeFacts',
            );
            expect(proposal?.function.parameters).toMatchObject({
              properties: {
                candidates: {
                  items: {
                    anyOf: expect.arrayContaining([
                      {
                        properties: {
                          field: { type: 'string', enum: ['debts'] },
                          value: {
                            type: 'array',
                            items: { type: 'array', items: { type: 'object' } },
                          },
                        },
                      },
                    ]) as unknown,
                  },
                },
              },
            });
          } else if (start && key === 'registration') {
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'region',
                  value: territory,
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(regionQuote),
                },
              ],
            });
          } else if (
            key === 'registration' &&
            exhaustedStep === 'registration'
          ) {
            toolCall = call('readField', { field: 'region', offset: 0 });
          } else if (key === 'registration' && !proposedCourt) {
            proposedCourt = true;
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'courtName',
                  value: court,
                  origin: 'inference',
                  explanation: 'Суд по субъекту места жительства.',
                  evidence: evidence(regionQuote),
                },
              ],
            });
          } else if (start && key === 'property') {
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'cashOnHand',
                  value: '2300.00',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(cash),
                },
              ],
            });
          } else if (start && key === 'consistency') {
            const reviewFields = input.review?.fields.map(({ key }) => key);
            expect(reviewFields).toContain('district');
            expect(reviewFields).not.toContain('middleName');
            expect(reviewFields).not.toContain('cashOnHand');
            expect(reviewFields).not.toContain('sroName');
            expect(tools).toContain('proposeFacts');
            expect(tools).toContain('recordMissingFields');
            expect(tools).toContain('finishReview');
            const proposal = body.tools?.find(
              ({ function: fn }) => fn.name === 'proposeFacts',
            );
            expect(JSON.stringify(proposal?.function.parameters)).not.toContain(
              '"middleName"',
            );
            expect(tools).toContain('reportDiscrepancy');
            toolCall = call('readField', { field: 'middleName', offset: 0 });
          } else if (key === 'consistency' && exhaustedStep === 'consistency') {
            if (exhaustedStepCalls === 2) {
              toolCall = call('readSource', {
                documentId: source,
                imagePath: null,
                offset: 0,
              });
            } else {
              expect(resultText).toContain('read_limit_reached');
            }
          } else if (
            key === 'consistency' &&
            resultText.includes('Лабораториевич') &&
            !observedDraft
          ) {
            observedDraft = true;
            toolCall = call('reportDiscrepancy', {
              fields: ['middleName'],
              explanation: 'Отчество в двух фрагментах различается.',
              evidence: [...evidence(quote), ...evidence(otherQuote)],
            });
          } else if (key === 'consistency' && !proposedDistrict) {
            proposedDistrict = true;
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'district',
                  value: 'Задонский район',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(districtQuote),
                },
                {
                  field: 'businessReceivables',
                  value: [],
                  origin: 'inference',
                  explanation: 'Предложение для проверки.',
                  evidence: evidence(quote),
                },
                {
                  field: 'businessPayments',
                  value: [],
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(quote),
                },
              ],
            });
          } else if (key === 'consistency' && !finishRequested) {
            expect(resultText).toContain('inference_requires_lawyer');
            expect(resultText).toContain('business_absence_not_supported');
            expect(resultText).toContain('fieldEmpty');
            finishRequested = true;
            toolCall = call('finishReview', {});
          } else if (
            key === 'consistency' &&
            incompleteReview &&
            !recordedReasons
          ) {
            expect(resultText).toContain('incomplete');
            recordedReasons = true;
            toolCall = call('recordMissingFields', {
              fields: [{ field: 'courtName', reason: 'lawyer_required' }],
            });
          } else if (
            key === 'consistency' &&
            !incompleteReview &&
            !triedDistrictRewrite
          ) {
            expect(resultText).toContain('incomplete');
            triedDistrictRewrite = true;
            toolCall = call('proposeFacts', {
              candidates: [
                {
                  field: 'district',
                  value: 'Другой район',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(districtQuote),
                },
                {
                  field: 'city',
                  value: 'Задонск',
                  origin: 'document',
                  explanation: null,
                  evidence: evidence(addresses),
                },
              ],
            });
          } else if (
            key === 'consistency' &&
            !incompleteReview &&
            !stoppedBeforeReasons
          ) {
            expect(resultText).toContain('field_not_empty');
            stoppedBeforeReasons = true;
          } else if (
            key === 'consistency' &&
            !incompleteReview &&
            !recordedReasons
          ) {
            expect(resultText).toContain('field_not_empty');
            expect(resultText).toContain('saved');
            recordedReasons = true;
            toolCall = call('recordMissingFields', {
              fields: input.review?.fields
                .filter(({ key }) => key !== 'city')
                .map(({ key }) => ({
                  field: key,
                  reason:
                    key === 'courtName'
                      ? 'lawyer_required'
                      : key === 'building'
                        ? 'unreadable_source'
                        : 'not_in_sources',
                })),
            });
          } else if (
            key === 'consistency' &&
            !incompleteReview &&
            recordedReasons &&
            !finishAccepted
          ) {
            expect(resultText).toContain('field_not_empty');
            expect(resultText).toContain('saved');
            finishAccepted = true;
            toolCall = call('finishReview', {});
          } else if (key === 'consistency' && finishAccepted) {
            expect(resultText).toContain('complete');
          }
          return completionStream({
            id: 'pilot-fixture',
            created: 1,
            model: 'fixture',
            choices: [
              {
                index: 0,
                message: toolCall
                  ? { role: 'assistant', content: null, tool_calls: [toolCall] }
                  : { role: 'assistant', content: 'Шаг завершён.' },
                finish_reason: toolCall
                  ? 'tool_calls'
                  : key === 'consistency' && completionLimit
                    ? 'length'
                    : 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
        },
        { preconnect: fetch.preconnect },
      ),
    });
    const files = new Map<string, Uint8Array>();
    const storage = {
      exists: (key: string) => Promise.resolve(files.has(key)),
      get: (key: string) => {
        const bytes = files.get(key);
        return bytes
          ? Promise.resolve(bytes)
          : Promise.reject(new Error('MISSING_PILOT_OBJECT'));
      },
      put: (key: string, bytes: Uint8Array) => {
        files.set(key, bytes);
        return Promise.resolve();
      },
      delete: (key: string) => {
        files.delete(key);
        return Promise.resolve();
      },
    };
    const config = integrationConfig({ databaseUrl, redisUrl });
    if (!config.worker) throw new Error('EXPECTED_WORKER_CONFIG');
    const pilotConfig = {
      ...config,
      worker: { ...config.worker, stepwiseAnalysis: true },
    };
    const logger = createLogger(
      {
        service: 'worker',
        environment: 'test',
        release: 'pilot',
        level: 'error',
      },
      { write: () => {} },
    );
    const api = createBackend(config, {
      logger,
      role: 'api',
      dependencies: { agents, storage },
    });
    let backend: ReturnType<typeof createBackend> | undefined;
    let worker: Awaited<ReturnType<typeof startJobWorker>> | undefined;
    try {
      backend = createBackend(pilotConfig, {
        logger,
        role: 'worker',
        dependencies: {
          agents,
          storage,
          parser: {
            parseDocument: () =>
              Promise.resolve({
                markdown: document,
                processorVersion: 'fixture',
                images: [],
              }),
            eraseAttempt: () => Promise.resolve(),
          },
        },
      });
      await backend.ready();
      worker = await startJobWorker(backend.jobs, {
        prefix: `test-pilot-${workspaceId}`,
      });
      await db.anykoWorkspace.create({
        data: { id: workspaceId, name: 'Synthetic pilot' },
      });
      await api.workHttp.settings.save(scope, {
        baseURL: 'https://fixture.invalid/v1',
        extractionModel: 'fixture',
        visionModel: 'fixture',
        apiKey: crypto.randomUUID(),
      });
      const workId = await api.workHttp.intake.createWork(scope, {
        packageVersion: 'bfl-bankruptcy-v13',
        title: 'Пилот БФЛ',
      });
      const source = await api.workHttp.intake.uploadDocument(scope, {
        workId,
        filename: 'Заявитель.pdf',
        bytes: new TextEncoder().encode('%PDF-1.7\nsynthetic'),
        correlationId: crypto.randomUUID(),
        requestKey: crypto.randomUUID(),
      });
      documentId = source.id;
      const wait = async (
        predicate: (
          view: Awaited<ReturnType<typeof api.workHttp.views.get>>,
        ) => boolean,
      ) => {
        for (let retry = 0; retry < 250; retry++) {
          const view = await api.workHttp.views.get(scope, workId);
          if (predicate(view)) return view;
          await Bun.sleep(40);
        }
        throw new Error('PILOT_TIMEOUT');
      };
      const draft = await wait((view) =>
        view.runs.some(
          ({ kind, status }) =>
            kind === 'analysis' &&
            ['succeeded', 'failed', 'partial'].includes(status),
        ),
      );
      expect(observedQuoteRejection).toBe(true);
      if (limitedStep) {
        const reviewReadLimit = exhaustedStep === 'consistency';
        const firstStep = exhaustedStep === 'identity';
        const errorCode = completionLimit
          ? 'LLM_COMPLETION_LIMIT'
          : incompleteReview || reviewReadLimit
            ? 'ANALYSIS_REVIEW_INCOMPLETE'
            : 'LLM_STEP_LIMIT';
        expect(exhaustedStepCalls).toBe(
          reviewReadLimit ? 3 : completionLimit ? 6 : incompleteReview ? 7 : 4,
        );
        expect(steps).toHaveLength(
          limitedStep === 'consistency' ? 9 : firstStep ? 1 : 2,
        );
        expect(steps.slice(-1)).toEqual([limitedStep]);
        const run = draft.runs[0];
        if (!run) throw new Error('PILOT_ANALYSIS_MISSING');
        expect(run.status).toBe('partial');
        expect(run.steps.at(-1)).toMatchObject({
          stage: 'reconciliation',
          status: 'failed',
          errorCode,
        });
        const history = await api.workHttp.views.agentHistory(
          scope,
          workId,
          run.id,
          1,
          100,
        );
        const outcome = history.items.find(({ kind }) => kind === 'decision');
        expect(JSON.parse(outcome?.output ?? '{}')).toMatchObject({
          failedStep: { step: limitedStep, errorCode },
        });
        if (incompleteReview) {
          const decision = z
            .object({
              failedStep: z.object({ unreportedFields: z.array(z.string()) }),
            })
            .parse(JSON.parse(outcome?.output ?? '{}'));
          expect(decision.failedStep.unreportedFields).toContain('postalCode');
          expect(decision.failedStep.unreportedFields).not.toContain(
            'district',
          );
          expect(observedContinuation).toBe(!completionLimit);
          expect(draft.facts.values.district).toBe('Задонский район');
          expect(JSON.parse(outcome?.output ?? '{}')).toMatchObject({
            reviewSummary: {
              status: 'partial',
              ...(completionLimit && { errorCode: 'LLM_COMPLETION_LIMIT' }),
            },
            unfilledFields: [{ field: 'courtName' }],
            discrepancies: [{ fields: ['middleName'] }],
          });
          expect(draft.facts.values.middleName).toBe('Лабораториевич');
          return;
        }
        if (reviewReadLimit || firstStep) {
          expect(
            history.items.find(
              ({ errorCode }) => errorCode === 'CONTEXT_TOOL_LIMIT',
            ),
          ).toMatchObject({
            kind: 'tool',
            status: 'failed',
          });
          if (reviewReadLimit) {
            expect(draft.facts.values.middleName).toBe('Лабораториевич');
            expect(draft.facts.values.cashOnHand).toBe('2300.00');
            return;
          }
        }
        const persisted = await db.runStep.findFirstOrThrow({
          where: { runId: run.id, stage: 'reconciliation' },
        });
        expect(persisted.output).toMatchObject({
          analysisCheckpoint: {
            finished: firstStep ? [] : [{ key: 'identity' }],
            pendingCandidates: expect.arrayContaining([
              expect.objectContaining({
                field: firstStep ? 'middleName' : 'region',
              }),
            ]) as unknown,
          },
        });
        expect(draft.facts.values.middleName).toBe(
          firstStep ? null : 'Лабораториевич',
        );
        expect(draft.facts.values.region).toBeNull();
        return;
      }
      expect(draft.runs[0]?.status).toBe('succeeded');
      expect(steps).toEqual([
        'identity',
        'registration',
        'obligations',
        'employment',
        'family',
        'property',
        'circumstances',
        'attachments',
        'consistency',
      ]);
      expect(systemMessages.size).toBe(1);
      expect(observedSource).toBe(true);
      expect(observedDraft).toBe(true);
      expect(observedContinuation).toBe(true);
      expect(draft.facts.values.middleName).toBe('Лабораториевич');
      expect(draft.facts.values.district).toBe('Задонский район');
      expect(draft.facts.values.cashOnHand).toBe('2300.00');
      expect(draft.facts.values.city).toBe('Задонск');
      expect(draft.facts.values.courtName).toBeNull();
      expect(
        draft.facts.candidates.find(
          ({ field, value }) => field === 'courtName' && value === court,
        ),
      ).toMatchObject({
        field: 'courtName',
        origin: 'inference',
        value: court,
        evidence: [{ quote: regionQuote }],
      });
      expect(draft.facts.candidates[0]?.evidence[0]?.documentId).toBe(
        documentId,
      );
      const analysis = draft.runs.find(({ kind }) => kind === 'analysis');
      if (!analysis) throw new Error('PILOT_ANALYSIS_MISSING');
      const history = await api.workHttp.views.agentHistory(
        scope,
        workId,
        analysis.id,
        1,
        100,
      );
      const accepted = history.items.find(
        ({ kind, status }) => kind === 'decision' && status === 'accepted',
      );
      expect(JSON.parse(accepted?.output ?? '{}')).toMatchObject({
        steps: steps.map((key) => ({ key })),
        discrepancies: [
          {
            fields: ['middleName'],
            evidence: [{ quote }, { quote: otherQuote }],
          },
        ],
      });
      const reasons = z
        .object({
          unfilledFields: z.array(
            z.object({
              field: z.string(),
              label: z.string(),
              reason: z.string(),
            }),
          ),
        })
        .parse(JSON.parse(accepted?.output ?? '{}')).unfilledFields;
      expect(reasons.find(({ field }) => field === 'courtName')?.reason).toBe(
        'Заполняет юрист',
      );
      expect(reasons.find(({ field }) => field === 'postalCode')?.reason).toBe(
        'Сведений нет в источниках',
      );
      expect(reasons.find(({ field }) => field === 'building')?.reason).toBe(
        'Источник неразборчив',
      );
      expect(
        reasons.some(
          ({ field }) => field === 'district' || field === 'middleName',
        ),
      ).toBe(false);
      await api.workHttp.review.confirmFacts(scope, {
        workId,
        revision: draft.work.revision,
      });
      const confirmed = await wait(
        (view) => view.work.confirmedRevision === view.work.revision,
      );
      await api.workHttp.generation.startGeneration(scope, {
        workId,
        revision: confirmed.work.revision,
        correlationId: crypto.randomUUID(),
      });
      const view = await wait((state) =>
        state.generations.some(({ status }) => status === 'succeeded'),
      );
      const generation = view.generations.find(
        ({ status }) => status === 'succeeded',
      );
      if (!generation) throw new Error('PILOT_GENERATION_MISSING');
      expect(
        generation.files.map(({ templateVersion }) => templateVersion).sort(),
      ).toEqual(['bfl-creditors-v3', 'bfl-inventory-v2', 'bfl-statement-v11']);
      for (const file of generation.files) {
        const { bytes } = await api.workHttp.generation.downloadResult(scope, {
          workId,
          generationId: brandGenerationId(generation.id),
          fileId: brandFileId(file.id),
        });
        const xml = strFromU8(
          unzipSync(bytes)['word/document.xml'] ?? new Uint8Array(),
        );
        expect(xml).toContain('Лабораториевич');
        if (file.templateVersion === 'bfl-inventory-v2')
          expect(xml.replace(/\s/gu, ' ')).toContain('2 300,00');
      }
    } finally {
      await worker?.stop();
      await backend?.stop();
      await api.stop();
      try {
        const where = { workspaceId };
        await db.processingIo.deleteMany({ where });
        await db.workArtifact.deleteMany({ where });
        await db.workAgentThread.deleteMany({ where });
        await db.work.deleteMany({ where });
        await db.idempotencyKey.deleteMany({ where });
        await db.llmSettings.deleteMany({ where });
        await db.documentArtifact.deleteMany({ where });
        await db.runAttempt.deleteMany({ where });
        await db.sourceUpload.deleteMany({ where });
        await db.resultUpload.deleteMany({ where });
        await db.run.deleteMany({ where });
        await db.sourceDocument.deleteMany({ where });
        await db.auditEvent.deleteMany({ where });
        await db.anykoWorkspace.deleteMany({ where: { id: workspaceId } });
      } finally {
        await db.$disconnect();
        await pool.end().catch(() => {});
      }
    }
  },
  30000,
);
