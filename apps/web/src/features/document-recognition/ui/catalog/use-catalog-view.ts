import { useSyncExternalStore } from 'react';

type CatalogView = 'list' | 'grid';

// Настройка интерфейса в памяти вкладки: переживает переходы между разделами, но не перезагрузку.
let current: CatalogView = 'list';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setView(next: CatalogView) {
  current = next;
  for (const listener of listeners) listener();
}

export function useCatalogView() {
  const view = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'list' as const,
  );
  return [view, setView] as const;
}
