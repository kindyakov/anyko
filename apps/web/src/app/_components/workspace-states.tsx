import { RotateCw } from 'lucide-react';

import { Button } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

// Состояния загрузки и недоступности сервера для разделов рабочей области и корневых маршрутов.
export function WorkspaceLoading() {
  return (
    <div aria-busy className="grid min-h-[70dvh] place-items-center">
      <span role="status" className="sr-only">
        Открываем рабочую область
      </span>
      <EventHorizon state="active" className="animate-fade size-44" />
    </div>
  );
}

export function WorkspaceUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="animate-rise flex max-w-md flex-col items-center text-center">
      <EventHorizon state="calm" className="mb-4 size-44" />
      <h1 className="font-heading text-2xl font-bold">
        Не удалось открыть рабочую область
      </h1>
      <p role="alert" className="text-muted mt-3 mb-7 leading-7">
        Сервер не ответил. Проверьте подключение и повторите попытку.
      </p>
      <Button
        size="lg"
        onClick={() => {
          onRetry();
        }}
      >
        <RotateCw size={17} />
        Повторить
      </Button>
    </section>
  );
}
