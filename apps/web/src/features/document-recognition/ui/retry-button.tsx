'use client';
import { RotateCw } from 'lucide-react';

import { Button, Tooltip } from '@anyko/ui';

export function DocumentRetryButton({
  loading = false,
  disabled = false,
  compact = false,
  onRetry,
}: {
  loading?: boolean;
  disabled?: boolean;
  /** Только значок; полное название остаётся доступным и в подсказке. */
  compact?: boolean;
  onRetry: () => void;
}) {
  if (compact)
    return (
      <Tooltip content="Повторить распознавание">
        <Button
          variant="ghost"
          size="icon-sm"
          loading={loading}
          disabled={disabled}
          aria-label="Повторить"
          onClick={onRetry}
        >
          <RotateCw size={16} />
        </Button>
      </Tooltip>
    );
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
