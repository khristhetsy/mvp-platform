"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type Toast = ToastInput & { id: number; variant: ToastVariant };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** Show an ephemeral toast. Must be used under <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const AUTO_DISMISS_MS = 5000;
let toastCounter = 0;

const VARIANT_STYLES: Record<
  ToastVariant,
  { accent: string; icon: typeof Info; iconClass: string }
> = {
  success: { accent: "#1D9E75", icon: CheckCircle2, iconClass: "text-emerald-600" },
  error: { accent: "#D94F4F", icon: AlertCircle, iconClass: "text-rose-600" },
  info: { accent: "#534AB7", icon: Info, iconClass: "text-indigo-600" },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { accent, icon: Icon, iconClass } = VARIANT_STYLES[toast.variant];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_32px_rgba(12,35,64,0.14)]"
      style={{ animation: "capToastIn .28s cubic-bezier(.22,.8,.3,1) both" }}
    >
      <div style={{ height: 3, background: accent }} />
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} strokeWidth={1.9} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs leading-5 text-slate-600">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { variant: "info", ...input, id }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-5 z-[9999] flex flex-col gap-2">
        <style>{`@keyframes capToastIn { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
