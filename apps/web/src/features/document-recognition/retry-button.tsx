'use client';
import { RotateCw } from 'lucide-react';

import { Button } from '@anyko/ui';

export function DocumentRetryButton({
  loading = false,
  disabled = false,
  onRetry,
}: {
  loading?: boolean;
  disabled?: boolean;
  onRetry: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      disabled={disabled}
      onClick={onRetry}
    >
      <RotateCw size={15} />
      Повторить
    </Button>
  );
}
