'use client';
import { useState } from 'react';
import { documentResultSchema } from '@anyko/contracts';
import { requestApi } from '../../lib/api/client';
import { ResultPreview } from '../documents';
import type { z } from 'zod';

export function SourcePreview({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<z.infer<typeof documentResultSchema>>();
  const [error, setError] = useState('');
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open && !result)
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
      <summary>Распознанный исходник</summary>
      {error && !result && <p role="status">{error}</p>}
      {result && (
        <ResultPreview markdown={result.markdown} images={result.images} />
      )}
    </details>
  );
}
