'use client';
import { WorkspaceUnavailable } from '@/app/_components/workspace-states';
import { errorReference } from '@/lib/error-reference';

// Корневая граница: сбой проверки сессии в layout и страницы входа показывают то же состояние.
export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-black px-5">
      <WorkspaceUnavailable onRetry={retry} reference={errorReference(error)} />
    </main>
  );
}
