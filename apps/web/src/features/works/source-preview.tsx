'use client';
import { useState } from 'react';
import type { z } from 'zod';

import { documentResultSchema } from '@anyko/contracts';

import { Disclosure } from '@/components/ui/disclosure';
import { ResultPreview } from '@/features/documents';
import { requestApi } from '@/lib/api/client';

export function SourcePreview({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<z.infer<typeof documentResultSchema>>();
  const [error, setError] = useState('');
  return (
    <Disclosure
      title="Распознанный исходник"
      onOpenChange={(open) => {
        if (open && !result)
          void requestApi(
            `/documents/${documentId}/result`,
            documentResultSchema,
          )
            .then(setResult)
            .catch(() => {
              setError(
                'Результат пока недоступен. Повторно раскройте блок после завершения распознавания.',
              );
            });
      }}
    >
      {error && !result && <p role="status">{error}</p>}
      {result && (
        <ResultPreview markdown={result.markdown} images={result.images} />
      )}
    </Disclosure>
  );
}
