import type { FieldKey, WorkView } from '@anyko/contracts';

export type StepKey = 'files' | 'extraction' | 'review' | 'documents';

export const journeySteps: {
  key: StepKey;
  title: string;
  caption: string;
}[] = [
  { key: 'files', title: 'Файлы', caption: 'PDF, DOCX, фото' },
  { key: 'extraction', title: 'Извлечение', caption: 'Anyko читает файлы' },
  { key: 'review', title: 'Проверка', caption: 'Вы подтверждаете сведения' },
  { key: 'documents', title: 'Документы', caption: 'Готовый комплект DOCX' },
];

type Run = WorkView['runs'][number];

export type WorkStage =
  | { kind: 'empty' }
  | { kind: 'ready'; pending: number; first: boolean }
  | { kind: 'processing'; run: Run; done: number; total: number }
  | { kind: 'review'; run: Run; fields: number; conflicts: number }
  | { kind: 'confirmed' }
  | { kind: 'generating' }
  | { kind: 'generated'; files: number };

const active = (run: Run) =>
  run.status === 'queued' || run.status === 'running';
const newest = (runs: Run[]) =>
  [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

/** Fields whose extracted variants disagree with each other. */
export function conflictingFields(view: WorkView): Set<FieldKey> {
  const variants = new Map<FieldKey, Set<string>>();
  for (const candidate of view.facts.candidates) {
    const set = variants.get(candidate.field) ?? new Set<string>();
    set.add(JSON.stringify(candidate.value));
    variants.set(candidate.field, set);
  }
  const result = new Set<FieldKey>(view.session?.context?.conflictFields);
  for (const [field, set] of variants) if (set.size > 1) result.add(field);
  return result;
}

/** The single current situation of a work, used to tell the user what comes next. */
export function workStage(view: WorkView): WorkStage {
  if (!view.documents.length) return { kind: 'empty' };
  const analyses = view.runs.filter((run) => run.kind === 'analysis');
  const running = analyses.find(active);
  if (running)
    return {
      kind: 'processing',
      run: running,
      done: running.steps.filter(
        (step) => step.status !== 'queued' && step.status !== 'running',
      ).length,
      total: running.steps.length,
    };
  if (view.runs.some((run) => run.kind === 'generation' && active(run)))
    return { kind: 'generating' };
  const last = newest(analyses);
  const pending = last
    ? view.documents.filter((doc) => doc.createdAt > last.createdAt).length
    : view.documents.length;
  if (!last || pending) return { kind: 'ready', pending, first: !last };
  const generation = view.generations.find(
    (item) =>
      item.revision === view.work.revision &&
      (item.status === 'succeeded' || item.status === 'partial'),
  );
  if (generation)
    return {
      kind: 'generated',
      files: generation.files.filter((file) => file.status === 'succeeded')
        .length,
    };
  if (view.work.confirmedRevision === view.work.revision)
    return { kind: 'confirmed' };
  return {
    kind: 'review',
    run: last,
    fields: new Set(view.facts.candidates.map((item) => item.field)).size,
    conflicts: conflictingFields(view).size,
  };
}

export function stepOf(stage: WorkStage): StepKey {
  switch (stage.kind) {
    case 'empty':
    case 'ready':
      return 'files';
    case 'processing':
      return 'extraction';
    case 'review':
      return 'review';
    case 'confirmed':
    case 'generating':
    case 'generated':
      return 'documents';
  }
}

export const runStatusLabels: Record<Run['status'], string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Готово',
  partial: 'Готово частично',
  failed: 'Ошибка',
  cancelled: 'Остановлено',
};
export const stepStatusLabels: Record<Run['steps'][number]['status'], string> =
  {
    queued: 'Ожидает',
    running: 'Выполняется',
    succeeded: 'Готово',
    failed: 'Ошибка',
    skipped: 'Не требуется',
  };
export const stageLabels: Record<Run['steps'][number]['stage'], string> = {
  parsing: 'Распознавание текста',
  vision: 'Анализ изображений',
  extraction: 'Поиск сведений',
  reconciliation: 'Сопоставление документов',
  generation: 'Формирование DOCX',
};
const errors: Record<string, string> = {
  OCR_FAILED: 'Не удалось распознать текст файла.',
  PARSING_FAILED: 'Не удалось прочитать содержимое файла.',
  MODEL_CALL_FAILED: 'Модель не ответила. Проверьте подключение в настройках.',
  STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED:
    'Модель вернула ответ в неверном формате.',
  CONTEXT_RECONCILIATION_FAILED:
    'Не удалось сопоставить сведения между документами. Извлечённые из файлов сведения сохранены.',
  ATTEMPTS_EXHAUSTED: 'Все попытки исчерпаны.',
  DOCUMENT_DELETED: 'Файл удалён во время обработки.',
  DOCUMENT_GENERATION_FAILED: 'Не удалось сформировать документ.',
  GENERATION_INTERRUPTED: 'Формирование было прервано.',
  WORK_PROCESSING_FAILED: 'Обработка завершилась с ошибкой.',
};
export function errorText(code: string) {
  return errors[code] ?? `Этап завершился с ошибкой (${code}).`;
}
