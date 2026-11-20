'use client';

import { Toast } from '@base-ui/react/toast';
import { AlertTriangle, Check, CircleAlert, Info, X } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

import { Spinner } from './spinner';

export type ToastVariant =
  'default' | 'success' | 'error' | 'warning' | 'loading';
export type ToastMode = 'timed' | 'persistent';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  mode?: ToastMode;
  content?: ReactNode;
}

type ToastData = { content?: ReactNode };

const timedDuration = 5000;
const icons = {
  default: Info,
  success: Check,
  error: CircleAlert,
  warning: AlertTriangle,
};

function toastOptions({
  title,
  description,
  content,
  variant = 'default',
  mode = 'timed',
}: ToastOptions) {
  const priority = variant === 'error' ? 'high' : 'low';
  // Base UI reserves the loading type for its own non-dismissible promise timer.
  const type = variant === 'loading' ? 'progress' : variant;
  const timeout = mode === 'timed' ? timedDuration : 0;
  return {
    title,
    description,
    type,
    timeout,
    priority,
    data: { content },
  } as const;
}

export function useToast() {
  const { add, update, close } = Toast.useToastManager<ToastData>();
  return {
    add: useCallback(
      (options: ToastOptions) => add(toastOptions(options)),
      [add],
    ),
    /** Replaces the content and restarts the selected dismissal mode. */
    update: (id: string, options: ToastOptions) => {
      update(id, toastOptions(options));
    },
    close: (id: string) => {
      close(id);
    },
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={5}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  const [paused, setPaused] = useState(false);
  const [resumed, setResumed] = useState<Map<string, number>>();
  // Adding a toast or restarting a timed toast pauses the whole expanded stack again.
  if (
    resumed &&
    toasts.some(
      ({ id, updateKey, timeout }) =>
        !resumed.has(id) ||
        (timeout === timedDuration && resumed.get(id) !== (updateKey ?? 0)),
    )
  ) {
    setResumed(undefined);
  }
  const followViewport = () => {
    setResumed(undefined);
  };
  const resume = useEffectEvent(() => {
    // Base UI resumes existing timers on window focus, even inside an expanded stack.
    setResumed(
      new Map(toasts.map(({ id, updateKey }) => [id, updateKey ?? 0])),
    );
    setPaused(false);
  });
  useEffect(() => {
    const pause = () => {
      setPaused(true);
    };
    const focus = () => {
      resume();
    };
    window.addEventListener('blur', pause);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', focus);
    };
  }, []);
  return (
    <Toast.Portal>
      <Toast.Viewport
        aria-label="Уведомления"
        className="anyko-toast-viewport"
        data-timer-paused={paused || undefined}
        onMouseEnter={followViewport}
        onMouseMove={followViewport}
        onFocus={(event) => {
          if (event.target.matches(':focus-visible')) followViewport();
        }}
      >
        {toasts.map((toast) => {
          const type = toast.type;
          const timed = toast.timeout === timedDuration;
          const Icon =
            type === 'success' || type === 'error' || type === 'warning'
              ? icons[type]
              : icons.default;
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              className="anyko-toast"
              data-timed={timed || undefined}
            >
              <Toast.Content className="anyko-toast-content">
                <span className="anyko-toast-icon" aria-hidden>
                  {type === 'progress' ? (
                    <Spinner className="size-5" />
                  ) : (
                    <Icon size={18} strokeWidth={2} />
                  )}
                </span>
                <div className="anyko-toast-copy">
                  <Toast.Title className="anyko-toast-title" />
                  {toast.description && (
                    <Toast.Description
                      className="anyko-toast-description"
                      data-base-ui-swipe-ignore
                    />
                  )}
                  {toast.data?.content != null && (
                    <div
                      className="anyko-toast-extra"
                      data-base-ui-swipe-ignore
                    >
                      {toast.data.content}
                    </div>
                  )}
                </div>
                <Toast.Close
                  className="anyko-toast-close"
                  aria-label="Закрыть уведомление"
                >
                  <X size={16} aria-hidden />
                </Toast.Close>
              </Toast.Content>
              {timed && (
                <div className="anyko-toast-timer" aria-hidden>
                  <span
                    key={toast.updateKey}
                    data-window-resumed={
                      resumed?.get(toast.id) === (toast.updateKey ?? 0) ||
                      undefined
                    }
                    style={{ animationDuration: `${String(timedDuration)}ms` }}
                  />
                </div>
              )}
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
