"use client";

import { useToastQueue, type ToastVariant } from "@/lib/toast/toast-context";

const VARIANT_STYLES: Record<
  ToastVariant,
  { accent: string; progress: string; icon: React.ReactNode }
> = {
  success: {
    accent: "bg-emerald-500",
    progress: "bg-emerald-500",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-emerald-500"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4.5 8.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  error: {
    accent: "bg-red-500",
    progress: "bg-red-500",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-red-500"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5.5 5.5l5 5M10.5 5.5l-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  info: {
    accent: "bg-indigo-500",
    progress: "bg-indigo-500",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-indigo-500"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 7v5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="5" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  warning: {
    accent: "bg-amber-500",
    progress: "bg-amber-500",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-amber-500"
      >
        <path
          d="M8 2L14.5 13.5H1.5L8 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 6.5v3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
};

export function Toaster() {
  const { toasts, removeToast } = useToastQueue();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .toast-enter {
          animation: toast-slide-in 280ms ease forwards;
        }
        .toast-progress {
          animation: toast-progress 4s linear forwards;
        }
      `}</style>
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
        style={{ width: 320 }}
      >
        {toasts.map((toast) => {
          const styles = VARIANT_STYLES[toast.variant];
          return (
            <div
              key={toast.id}
              className="toast-enter relative overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5"
            >
              {/* Left accent stripe */}
              <div
                className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`}
              />

              {/* Content row */}
              <div className="flex items-center gap-3 pl-5 pr-3 py-3">
                {styles.icon}
                <p className="flex-1 text-sm font-medium text-slate-900">
                  {toast.message}
                </p>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="ml-1 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2 2l10 10M12 2L2 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-[3px] w-full bg-slate-100">
                <div
                  className={`toast-progress h-full ${styles.progress}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
