'use client';
import { DocumentWorkspace } from '@/features/document-recognition';
import { AddRecognitionsToWork } from '@/features/works';
import { useMembership } from '@/lib/api/workspace';

export default function RecognitionPage() {
  const { rights } = useMembership();
  const canAttach =
    rights.includes('documents.upload') &&
    rights.includes('recognitions.use') &&
    (rights.includes('works.read') || rights.includes('works.create'));
  return (
    <DocumentWorkspace
      AddToWork={canAttach ? AddRecognitionsToWork : undefined}
    />
  );
}
