"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => {
        const next = [{ id, message, variant }, ...prev];
        return next.slice(0, MAX_TOASTS);
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function useToast() {
  const { addToast } = useToastContext();

  const success = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  );
  const error = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );
  const info = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast],
  );
  const warning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast],
  );

  return { success, error, info, warning };
}

export function useToastQueue(): Pick<ToastContextValue, "toasts" | "removeToast"> {
  const { toasts, removeToast } = useToastContext();
  return { toasts, removeToast };
}
