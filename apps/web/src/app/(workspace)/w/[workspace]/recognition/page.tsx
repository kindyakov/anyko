'use client';
import { useQueryClient } from '@tanstack/react-query';

import { DocumentWorkspace } from '@/features/document-recognition';
import {
  AddRecognitionsToWork,
  invalidateWorkspaceWorks,
} from '@/features/works';
import { useMembership, useWorkspaceId } from '@/lib/api/workspace';

export default function RecognitionPage() {
  const { rights } = useMembership();
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();
  const canAttach =
    rights.includes('documents.upload') &&
    rights.includes('recognitions.use') &&
    (rights.includes('works.read') || rights.includes('works.create'));
  return (
    <DocumentWorkspace
      AddToWork={canAttach ? AddRecognitionsToWork : undefined}
      onDeletionAccepted={() => invalidateWorkspaceWorks(client, workspaceId)}
    />
  );
}
