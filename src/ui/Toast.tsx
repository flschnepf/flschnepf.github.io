import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ToastOptions {
  message: string;
  /** Optionale Aktion, in der Regel "Rückgängig". */
  action?: { label: string; onAction: () => void | Promise<void> };
  durationMs?: number;
}

type ShowToast = (options: ToastOptions) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

/** Ersetzt `alert()`: nicht blockierend und im Standalone-Modus unauffaellig. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback<ShowToast>(
    (options) => {
      clearTimer();
      setToast(options);
      timer.current = setTimeout(() => setToast(null), options.durationMs ?? 6000);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                clearTimer();
                setToast(null);
                void toast.action?.onAction();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
