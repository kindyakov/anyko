'use client';
import { WorkspaceUnavailable } from '@/app/_components/workspace-states';

export default function WorksError({ retry }: { retry: () => void }) {
  return <WorkspaceUnavailable onRetry={retry} />;
}
