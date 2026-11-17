'use client';
import { WorkspaceUnavailable } from '@/app/_components/workspace-states';

// Корневая граница: сбой проверки сессии в layout и страницы входа показывают то же состояние.
export default function RootError({ retry }: { retry: () => void }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-black px-5">
      <WorkspaceUnavailable onRetry={retry} />
    </main>
  );
}
