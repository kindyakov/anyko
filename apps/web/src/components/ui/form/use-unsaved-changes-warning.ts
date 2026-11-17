'use client';
import { useEffect } from 'react';

// Предупреждает при закрытии или перезагрузке вкладки, пока в форме есть несохранённые правки.
// Черновик нигде не сохраняется: предупреждение — единственная защита от случайной потери ввода.
// Переходы внутри приложения этим хуком не перехватываются.
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [isDirty]);
}
