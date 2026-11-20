import type { WorkView } from '@anyko/contracts/works';

type Run = WorkView['runs'][number];
type Step = Run['steps'][number];

export function analysisRuns(runs: Run[]): Run[] {
  return runs
    .filter((run) => run.kind === 'analysis')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function runProgress(steps: Step[]) {
  const done = steps.filter(
    (step) => step.status !== 'queued' && step.status !== 'running',
  ).length;
  return {
    done,
    percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
  };
}

export function groupSteps(steps: Step[]) {
  const groups = new Map<string | null, Step[]>();
  for (const step of steps) {
    const list = groups.get(step.documentId) ?? [];
    list.push(step);
    groups.set(step.documentId, list);
  }
  return groups;
}

export function visionVisuals(steps: Step[], documentId: string | null) {
  return steps
    .filter((step) => step.stage === 'vision')
    .flatMap((step) =>
      step.visuals.map((visual) => ({
        ...visual,
        key: `${step.id}-${visual.path}`,
        documentId,
      })),
    );
}
