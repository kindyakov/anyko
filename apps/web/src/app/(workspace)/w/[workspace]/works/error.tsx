'use client';
import { WorkspaceUnavailable } from '@/app/_components/workspace-states';
import { errorReference } from '@/lib/error-reference';

export default function WorksError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <WorkspaceUnavailable onRetry={retry} reference={errorReference(error)} />
  );
}
