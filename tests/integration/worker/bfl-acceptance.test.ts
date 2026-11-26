import { expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { RedisClient } from 'bun';
import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';

import { createDatabase, createDatabasePool } from '@anyko/database';
import { createLogger } from '@anyko/logger';
import { startJobWorker } from '@anyko/worker/queues';

import type { DocumentAgents } from '../../../packages/backend/src/modules/agents';
import {
  brandFileId,
  brandGenerationId,
} from '../../../packages/backend/src/platform/ids';
import { literalSourceQuote } from '../../../packages/backend/src/platform/source-quote';
import { candidateSchema } from '../../../packages/backend/src/profiles/bfl/candidate';
import {
  type ApiBackend,
  createBackend,
} from '../../../packages/backend/src/runtime';
import { memberScope } from '../../../packages/backend/tests/support/scope';

import { integrationConfig } from './support/composition';

const fixtureRoot = join(import.meta.dir, '../../fixtures/bfl-acceptance');
const sourceSchema = z.object({
  sha256: z.hash('sha256'),
  text: z.string().min(1),
});
const fixtureSchema = z.object({
  files: z.record(z.string(), sourceSchema),
  candidates: z.array(
    z
      .object({
        evidence: z
          .array(z.object({ filename: z.string(), quote: z.string() }))
          .min(1),
      })
      .loose(),
  ),
});
const fixtures = z
  .object({ active: fixtureSchema, dismissed: fixtureSchema })
  .parse(await Bun.file(join(fixtureRoot, 'provider-fixtures.json')).json());
type Fixture = z.infer<typeof fixtureSchema>;
type Api = ApiBackend['workHttp'];
type View = Awaited<ReturnType<Api['views']['get']>>;
type Candidate = z.infer<typeof candidateSchema>;
const date = '21.11.2026';
const usage = { inputTokens: 0, outputTokens: 0 };
const live = process.env.ANYKO_BFL_ACCEPTANCE_LIVE === '1';
const update = process.env.ANYKO_BFL_ACCEPTANCE_WRITE_GOLDENS === '1';
if (live && update) throw new Error('Live responses cannot update the goldens');
const outputDir =
  process.env.ANYKO_BFL_ACCEPTANCE_OUTPUT_DIR ??
  (live ? 'work/bfl-acceptance/live' : undefined);
const lowerText = (value: unknown) =>
  typeof value === 'string' ? value.toLocaleLowerCase('ru') : undefined;
const digest = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

function textParts(bytes: Uint8Array) {
  return Object.fromEntries(
    Object.entries(unzipSync(bytes))
      .filter(
        ([name]) =>
          name.startsWith('word/') ||
          name.endsWith('.rels') ||
          name === '[Content_Types].xml',
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, body]) => [
        name,
        name.endsWith('.xml') || name.endsWith('.rels')
          ? strFromU8(body)
          : digest(body),
      ]),
  );
}

function providerFixture(fixture: Fixture): DocumentAgents {
  const sourceByHash = new Map(
    Object.values(fixture.files).map(({ sha256, text }) => [sha256, text]),
  );
  const unsupported = (): Promise<never> =>
    Promise.reject(new Error('Unexpected fixture provider operation'));
  return {
    ready: () => Promise.resolve(),
    eraseThread: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    chat: unsupported,
    extract: unsupported,
    reconcile: unsupported,
    describe({ bytes }) {
      const description = sourceByHash.get(digest(bytes));
      return description
        ? Promise.resolve({ description, usage })
        : Promise.reject(new Error('Unknown Vision fixture bytes'));
    },
    async runAnalysisStep(input) {
      await input.assertCurrent();
      const documents = new Map(
        input.documents.map(({ id, filename }) => [filename, id]),
      );
      const proposals: { candidate: Candidate; index: number }[] = [];
      for (const { evidence, ...row } of fixture.candidates) {
        if (!input.step.fields.some((key) => key === row.field)) continue;
        if (evidence.some(({ filename }) => !documents.has(filename))) continue;
        const bound = await Promise.all(
          evidence.map(async ({ filename, quote }) => {
            const documentId = documents.get(filename);
            if (!documentId) throw new Error(`Source unavailable: ${filename}`);
            const literal = literalSourceQuote(
              await input.readSource(documentId, null),
              quote,
            );
            if (!literal)
              throw new Error(
                `Fixture quote differs from source: ${filename} / ${quote}`,
              );
            return { documentId, imagePath: null, quote: literal };
          }),
        );
        proposals.push({
          candidate: candidateSchema.parse({ ...row, evidence: bound }),
          index: proposals.length,
        });
      }
      if (proposals.length) {
        await input.proposeFacts(
          crypto.randomUUID(),
          proposals,
          proposals.map(() => 'saved'),
          proposals.map(({ candidate }) => candidate.field),
        );
      }
      if (input.review) {
        await input.review.recordReasons(
          crypto.randomUUID(),
          input.review.remainingFields().map((field) => ({
            field,
            reason:
              field === 'courtName' ||
              field === 'courtAddress' ||
              field === 'attachments'
                ? 'lawyer_required'
                : 'not_in_sources',
          })),
        );
      }
      return { summary: input.step.title, usage };
    },
  };
}

const reviewedSources = [
  [
    '01-passport.png',
    'Паспорт гражданина Российской Федерации',
    'copy',
    'other',
  ],
  ['02-registration.docx', 'Сведения о регистрации', 'copy', 'other'],
  ['03-snils.pdf', 'Форма АДИ-РЕГ', 'copy', 'pensionAccount'],
  [
    '04-bank-vtb-current.docx',
    'Справка ВТБ № QA-5417',
    'paperOriginal',
    'debtCertificate',
  ],
  [
    '06-bank-t.docx',
    'Справка ТБанка № QA-620',
    'electronicOriginal',
    'debtCertificate',
  ],
  ['07-employment.docx', 'Сведения о трудовой деятельности', 'copy', 'other'],
  [
    '08-income-old.docx',
    'Справка о доходах первого работодателя',
    'copy',
    'other',
  ],
  [
    '09-income-new.docx',
    'Справка о доходах второго работодателя',
    'copy',
    'other',
  ],
  ['10-property.docx', 'Выписка из ЕГРН', 'electronicOriginal', 'egrn'],
  ['11-family.docx', 'Анкета о составе семьи', 'copy', 'other'],
  [
    '12-cash-and-names.docx',
    'Сведения об имуществе и личных данных',
    'copy',
    'other',
  ],
  ['13-inn.pdf', 'Уведомление о постановке на налоговый учёт', 'copy', 'other'],
  [
    '15-tax-status.docx',
    'Справка о состоянии расчётов с бюджетом',
    'copy',
    'other',
  ],
] as const;

function reviewedValues(view: View) {
  const { values, candidates } = view.facts;
  const registry = candidates
    .filter(({ creditorSource }) => creditorSource?.registry === 'cbr')
    .flatMap(({ value }) => (Array.isArray(value) ? value : []));
  const debts = Array.isArray(values.debts)
    ? values.debts.map((row) => {
        const entry = registry.find(
          (result) =>
            result.contractNumber === row.contractNumber &&
            result.inn === row.inn,
        );
        return entry?.address ? { ...row, address: entry.address } : row;
      })
    : values.debts;
  const submitted = reviewedSources.flatMap(
    ([filename, description, copyKind, category]) => {
      const source = view.documents.find(
        (document) =>
          document.filename === filename && document.status === 'succeeded',
      );
      return source
        ? [{ documentId: source.id, description, copyKind, category }]
        : [];
    },
  );
  return {
    ...values,
    debts,
    courtName:
      candidates.find(
        ({ field, courtSources }) => field === 'courtName' && courtSources,
      )?.value ?? values.courtName,
    courtAddress:
      candidates.find(
        ({ field, courtSources }) => field === 'courtAddress' && courtSources,
      )?.value ?? values.courtAddress,
    submittedAttachments: [
      ...submitted,
      {
        documentId: 'package:creditors',
        copyKind: 'paperOriginal',
        category: 'other',
        description:
          'Список кредиторов и должников гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
      },
      {
        documentId: 'package:inventory',
        copyKind: 'paperOriginal',
        category: 'other',
        description:
          'Опись имущества гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
      },
    ],
  };
}

async function clearQueues(redisUrl: string, prefix: string) {
  const redis = new RedisClient(redisUrl, { autoReconnect: false });
  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [next, keys] = z
        .tuple([z.string(), z.array(z.string())])
        .parse(
          await redis.send('SCAN', [
            cursor,
            'MATCH',
            `${prefix}:*`,
            'COUNT',
            '100',
          ]),
        );
      if (keys.length) await redis.send('UNLINK', keys);
      cursor = next;
    } while (cursor !== '0');
  } finally {
    redis.close();
  }
}

async function closeFixture(actions: readonly (() => Promise<unknown>)[]) {
  const failures: unknown[] = [];
  for (const close of actions) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'BFL acceptance cleanup failed');
}

async function withIsolatedDatabase(
  base: string,
  run: (url: string) => Promise<void>,
) {
  const name = `anyko_test_bfl_acceptance_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const url = new URL(base);
  url.pathname = '/postgres';
  const control = createDatabasePool(url.href);
  let created = false;
  try {
    await control.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    created = true;
    url.pathname = `/${name}`;
    const migration = Bun.spawn([process.execPath, 'run', 'db:migrate'], {
      env: { ...process.env, DATABASE_URL: url.href },
      stdout: 'ignore',
      stderr: 'inherit',
    });
    if (await migration.exited)
      throw new Error('Could not migrate the isolated BFL acceptance database');
    await run(url.href);
  } finally {
    try {
      if (created) await control.query(`DROP DATABASE "${name}"`);
    } finally {
      await control.end();
    }
  }
}

test.each(['active', 'dismissed'] as const)(
  'BFL acceptance package %s',
  async (name) => {
    const testDatabaseUrl = z
      .url()
      .refine((url) =>
        /^\/anyko_test(?:_[a-z0-9_]+)?$/.test(new URL(url).pathname),
      )
      .parse(process.env.TEST_DATABASE_URL);
    await withIsolatedDatabase(testDatabaseUrl, async (databaseUrl) => {
      const redisUrl = z.url().parse(process.env.TEST_REDIS_URL);
      const fixture = fixtures[name];
      const config = integrationConfig({ databaseUrl, redisUrl });
      if (!config.worker) throw new Error('Worker configuration is required');
      config.worker.stepwiseAnalysis = true;
      if (live)
        config.worker.mineru.baseUrl = z
          .url()
          .parse(process.env.ANYKO_BFL_ACCEPTANCE_MINERU_URL);
      const settings = live
        ? {
            baseURL: z.url().parse(process.env.ANYKO_BFL_ACCEPTANCE_BASE_URL),
            apiKey: z
              .string()
              .min(1)
              .parse(process.env.ANYKO_BFL_ACCEPTANCE_API_KEY),
            extractionModel: z
              .string()
              .min(1)
              .parse(process.env.ANYKO_BFL_ACCEPTANCE_MODEL),
            visionModel: z
              .string()
              .min(1)
              .parse(process.env.ANYKO_BFL_ACCEPTANCE_VISION_MODEL),
          }
        : {
            baseURL: 'https://fixture.invalid/v1',
            apiKey: 'offline-fixture-key',
            extractionModel: 'fixture',
            visionModel: 'fixture',
          };
      const pool = createDatabasePool(databaseUrl);
      const db = createDatabase(pool);
      const workspaceId = crypto.randomUUID();
      const prefix = `bfl-acceptance-${workspaceId}`;
      const scope = memberScope(workspaceId, 'bfl-acceptance');
      const blobs = new Map<string, Uint8Array>();
      const storage = {
        exists: (key: string) => Promise.resolve(blobs.has(key)),
        get(key: string) {
          const bytes = blobs.get(key);
          return bytes
            ? Promise.resolve(bytes)
            : Promise.reject(new Error('Missing test object'));
        },
        put(key: string, bytes: Uint8Array) {
          blobs.set(key, bytes);
          return Promise.resolve();
        },
        delete(key: string) {
          blobs.delete(key);
          return Promise.resolve();
        },
      };
      const logger = createLogger(
        {
          service: 'worker',
          environment: 'test',
          release: 'bfl-acceptance',
          level: 'error',
        },
        {
          write: (line) => {
            console.error(line);
          },
        },
      );
      const sources = new Map(
        Object.values(fixture.files).map((item) => [item.sha256, item.text]),
      );
      const offline = {
        agents: providerFixture(fixture),
        parser: {
          parseDocument(bytes: Uint8Array, format: string) {
            const markdown = sources.get(digest(bytes));
            if (!markdown)
              return Promise.reject(new Error('Unknown parser fixture bytes'));
            return Promise.resolve({
              markdown,
              processorVersion:
                format === 'pdf' ? 'mineru-4.1.7+cyrillic-pdf.1' : 'fixture',
              images:
                format === 'png'
                  ? [
                      {
                        bytes,
                        path: 'images/fixture.png',
                        contentType: 'image/png',
                      },
                    ]
                  : [],
            });
          },
          eraseAttempt: () => Promise.resolve(),
        },
      };
      const dependencies = { storage, ...(!live && offline) };
      const api = createBackend(config, { logger, role: 'api', dependencies });
      const backend = createBackend(config, {
        logger,
        role: 'worker',
        dependencies,
      });
      let worker: Awaited<ReturnType<typeof startJobWorker>> | undefined;
      const differences: string[] = [];
      try {
        await db.anykoWorkspace.create({
          data: { id: workspaceId, name: 'Synthetic BFL acceptance' },
        });
        await api.workHttp.settings.save(scope, {
          ...settings,
          extractionEnableReasoning: true,
          visionDisableReasoning: true,
        });
        const workId = await api.workHttp.intake.createWork(scope, {
          packageVersion: 'bfl-bankruptcy-v14',
          title: name,
        });
        const read = () => api.workHttp.views.get(scope, workId);
        const wait = async (predicate: (view: View) => boolean) => {
          const deadline = Date.now() + (live ? 1_500_000 : 45000);
          while (Date.now() < deadline) {
            const view = await read();
            if (predicate(view)) return view;
            await Bun.sleep(100);
          }
          throw new Error(
            'BFL acceptance worker did not reach a terminal state',
          );
        };
        const upload = async (filename: string) => {
          const source = fixture.files[filename];
          if (!source) throw new Error(`Missing fixture: ${filename}`);
          const bytes = new Uint8Array(
            await Bun.file(join(fixtureRoot, name, filename)).arrayBuffer(),
          );
          expect(digest(bytes)).toBe(source.sha256);
          return api.workHttp.intake.uploadDocument(scope, {
            workId,
            filename,
            bytes,
            correlationId: crypto.randomUUID(),
            requestKey: crypto.randomUUID(),
          });
        };
        const initialFiles = Object.keys(fixture.files).filter(
          (filename) => filename !== '16-supplement.docx',
        );
        for (const filename of initialFiles) await upload(filename);
        await backend.ready();
        worker = await startJobWorker(backend.jobs, { prefix });
        const analyzed = await wait(
          (view) =>
            view.documents.length === initialFiles.length &&
            !view.pendingUploadCount &&
            view.runs.some(
              ({ kind, status }) =>
                kind === 'analysis' &&
                ['succeeded', 'partial', 'failed'].includes(status),
            ),
        );
        if (outputDir) {
          const dir = join(outputDir, name);
          await mkdir(dir, { recursive: true });
          const { facts, documents, runs } = analyzed;
          await Bun.write(
            join(dir, 'automatic-fields.json'),
            JSON.stringify(
              {
                values: facts.values,
                manual: facts.manual,
                discrepancies: analyzed.discrepancyFields,
                awaitingChoice: facts.candidates.filter(
                  ({ origin }) => origin === 'inference',
                ),
                directCandidates: facts.candidates.filter(
                  ({ origin }) => origin === 'document',
                ),
                documents: documents.map(({ filename, status, errorCode }) => ({
                  filename,
                  status,
                  errorCode,
                })),
                analysis: runs
                  .filter(({ kind }) => kind === 'analysis')
                  .map(({ status, errorCode }) => ({ status, errorCode })),
              },
              null,
              2,
            ),
          );
        }
        expect(analyzed.facts.manual).toEqual([]);
        const check = (
          actual: unknown,
          expected: unknown,
          description: string,
        ) => {
          if (actual !== expected)
            differences.push(`${name}: ${description} — ${String(actual)}`);
        };
        check(
          analyzed.facts.values.citizenship,
          'Российская Федерация',
          'гражданство',
        );
        check(
          lowerText(analyzed.facts.values.birthPlace)?.includes('липецк'),
          true,
          'место рождения',
        );
        const expectedNames =
          name === 'active'
            ? {
                lastName: 'примеров',
                firstName: 'матвей',
                middleName: 'лабораториевич',
              }
            : {
                lastName: 'макетова',
                firstName: 'елена',
                middleName: 'павловна',
              };
        for (const key of ['lastName', 'firstName', 'middleName'] as const) {
          check(lowerText(analyzed.facts.values[key]), expectedNames[key], key);
        }
        check(analyzed.facts.values.courtName, null, 'суд до подтверждения');
        check(
          analyzed.documents.every(({ status }) => status === 'succeeded'),
          true,
          'готовы все исходники',
        );
        check(
          analyzed.runs.find(({ kind }) => kind === 'analysis')?.status,
          'succeeded',
          'анализ завершён',
        );
        check(
          analyzed.facts.values.submittedAttachments,
          null,
          'приложения до подтверждения',
        );
        check(
          analyzed.facts.values.district,
          null,
          'район отсутствует в адресе',
        );
        check(
          analyzed.facts.values.building,
          null,
          'корпус отсутствует в адресе',
        );
        await api.workHttp.review.editValues(scope, {
          workId,
          revision: analyzed.work.revision,
          values: { ...analyzed.facts.values, documentDate: date },
        });
        const generate = async (
          stage: 'automatic' | 'confirmed' | 'regenerated',
        ) => {
          const before = await read();
          const existing = new Set(before.generations.map(({ id }) => id));
          await api.workHttp.generation.startGeneration(scope, {
            workId,
            revision: before.work.revision,
            correlationId: crypto.randomUUID(),
          });
          const after = await wait((view) =>
            view.generations.some(
              ({ id, status }) =>
                !existing.has(id) && ['succeeded', 'failed'].includes(status),
            ),
          );
          const created = after.generations.find(({ id }) => !existing.has(id));
          if (!created || created.status !== 'succeeded')
            throw new Error(
              `Generation ${stage} failed: ${created?.files.map(({ errorCode }) => errorCode).join(', ') ?? 'no result'}`,
            );
          expect(created.files).toHaveLength(3);
          expect(after.facts.values.documentDate).toBe(date);
          for (const file of created.files) {
            const { bytes } = await api.workHttp.generation.downloadResult(
              scope,
              {
                workId,
                generationId: brandGenerationId(created.id),
                fileId: brandFileId(file.id),
              },
            );
            const goldenPath = join(
              fixtureRoot,
              'goldens',
              name,
              stage === 'regenerated' ? 'confirmed' : stage,
              file.filename,
            );
            if (outputDir) {
              const dir = join(outputDir, name, stage);
              await mkdir(dir, { recursive: true });
              await Bun.write(join(dir, file.filename), bytes);
            }
            if (update && stage !== 'regenerated') {
              await mkdir(join(fixtureRoot, 'goldens', name, stage), {
                recursive: true,
              });
              await Bun.write(goldenPath, bytes);
            }
            const expected = textParts(
              new Uint8Array(await Bun.file(goldenPath).arrayBuffer()),
            );
            const actual = textParts(bytes);
            for (const part of new Set([
              ...Object.keys(expected),
              ...Object.keys(actual),
            ]))
              if (expected[part] !== actual[part])
                differences.push(`${name}/${stage}/${file.filename}: ${part}`);
            const xml = actual['word/document.xml'] ?? '';
            expect(xml).toContain(date);
            if (!live && file.filename === 'statement.docx') {
              expect(xml).toContain(
                name === 'active'
                  ? '39 861,82'
                  : 'не осуществляю трудовую деятельность',
              );
              expect(xml).toContain(
                name === 'active' ? '172 500,25' : 'Макетову',
              );
            }
          }
        };
        await generate('automatic');
        const draft = await read();
        const selected = reviewedValues(draft);
        check(
          Boolean(selected.courtName && selected.courtAddress),
          true,
          'подтверждённый суд',
        );
        if (name === 'active')
          check(
            Array.isArray(selected.debts) &&
              new Set(
                selected.debts
                  .filter(({ address }) => address)
                  .map(({ inn }) => inn),
              ).size,
            2,
            'два адреса из ЦБ',
          );
        await api.workHttp.review.editValues(scope, {
          workId,
          revision: draft.work.revision,
          values: selected,
        });
        const edited = await read();
        await api.workHttp.review.confirmFacts(scope, {
          workId,
          revision: edited.work.revision,
        });
        if (outputDir) {
          const confirmed = await read();
          await Bun.write(
            join(outputDir, name, 'confirmed-fields.json'),
            JSON.stringify(confirmed.facts, null, 2),
          );
        }
        await generate('confirmed');
        if (name === 'active') {
          const before = await read();
          const previous = new Set(before.runs.map(({ id }) => id));
          const extra = await upload('16-supplement.docx');
          const reanalyzed = await wait(
            (view) =>
              view.documents.some(
                ({ id, status }) => id === extra.id && status === 'succeeded',
              ) &&
              !view.pendingUploadCount &&
              view.runs.some(
                ({ id, kind, status }) =>
                  !previous.has(id) &&
                  kind === 'analysis' &&
                  ['succeeded', 'partial', 'failed'].includes(status),
              ),
          );
          const followup = reanalyzed.runs.find(
            ({ id, kind }) => !previous.has(id) && kind === 'analysis',
          );
          if (!followup)
            throw new Error('Missing analysis for supplemental source');
          check(followup.status, 'succeeded', 'анализ дополнительного файла');
          const stored = await db.run.findUniqueOrThrow({
            where: { id: followup.id },
            select: { documentIds: true },
          });
          expect(z.array(z.uuid()).parse(stored.documentIds)).toContain(
            extra.id,
          );
          await generate('regenerated');
        }
        expect(differences).toEqual([]);
      } finally {
        await closeFixture([
          () => worker?.stop() ?? Promise.resolve(),
          () => backend.stop(),
          () => api.stop(),
          () => db.$disconnect(),
          () => pool.end(),
          () => clearQueues(redisUrl, prefix),
        ]);
      }
    });
  },
  live ? 3_300_000 : 90000,
);
