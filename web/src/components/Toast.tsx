"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "info" | "success" | "error" | "pending";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: ReactNode;
  /** ms before auto-dismiss; 0 keeps it until manually closed. */
  duration?: number;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TONE_STYLES: Record<ToastTone, string> = {
  info: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-100",
};

const TONE_ICON: Record<ToastTone, string> = {
  info: "ℹ",
  success: "✓",
  error: "✕",
  pending: "◷",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = ++idRef.current;
      const duration = toast.duration ?? 6000;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md ${TONE_STYLES[t.tone]} animate-[slidein_0.2s_ease-out]`}
          >
            <span className="mt-0.5 text-sm font-bold">{TONE_ICON[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.message && (
                <div className="mt-0.5 break-words text-xs opacity-90">{t.message}</div>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-xs opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
