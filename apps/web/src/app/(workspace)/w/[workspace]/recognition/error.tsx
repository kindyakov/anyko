'use client';
import { WorkspaceUnavailable } from '@/app/_components/workspace-states';

export default function RecognitionError({ retry }: { retry: () => void }) {
  return <WorkspaceUnavailable onRetry={retry} />;
}
