"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatApiError } from "@/lib/api/errors";
import {
  formatResponseBody,
  type AdminActionHealthSnapshot,
  type AdminActionHealthUpdate,
} from "@/lib/admin/action-health";

type AdminActionHealthContextValue = AdminActionHealthSnapshot & {
  recordAction: (update: AdminActionHealthUpdate) => void;
  recordApiResult: (input: {
    button: string;
    url: string;
    status: number;
    body: unknown;
    errorMessage?: string | null;
  }) => void;
  runHealthCheck: () => Promise<void>;
};

const AdminActionHealthContext = createContext<AdminActionHealthContextValue | null>(null);

type ProviderProps = {
  userId: string;
  userRole: string;
  serviceRoleConfigured: boolean;
  children: ReactNode;
};

export function AdminActionHealthProvider({
  userId,
  userRole,
  serviceRoleConfigured,
  children,
}: ProviderProps) {
  const [state, setState] = useState<Omit<AdminActionHealthSnapshot, "userId" | "userRole" | "serviceRoleConfigured">>({
    lastButtonClicked: null,
    lastApiUrl: null,
    lastHttpStatus: null,
    lastResponseBody: null,
    lastErrorMessage: null,
    healthCheckLoading: false,
    healthCheckResult: null,
    healthCheckError: null,
  });

  const recordAction = useCallback((update: AdminActionHealthUpdate) => {
    setState((current) => ({ ...current, ...update }));
  }, []);

  const recordApiResult = useCallback(
    (input: { button: string; url: string; status: number; body: unknown; errorMessage?: string | null }) => {
      setState((current) => ({
        ...current,
        lastButtonClicked: input.button,
        lastApiUrl: input.url,
        lastHttpStatus: input.status,
        lastResponseBody: formatResponseBody(input.body),
        lastErrorMessage: input.errorMessage ?? null,
      }));
    },
    [],
  );

  const runHealthCheck = useCallback(async () => {
    recordAction({
      lastButtonClicked: "Test Admin API",
      lastApiUrl: "/api/admin/health",
      healthCheckLoading: true,
      healthCheckError: null,
      healthCheckResult: null,
      lastErrorMessage: null,
    });

    try {
      const response = await fetch("/api/admin/health", { method: "GET", cache: "no-store" });
      const raw = await response.text();
      let body: unknown = raw;

      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }

      const errorMessage = response.ok
        ? null
        : formatApiError(body, typeof body === "string" ? body : `Health check failed (${response.status}).`);

      recordApiResult({
        button: "Test Admin API",
        url: "/api/admin/health",
        status: response.status,
        body,
        errorMessage,
      });

      setState((current) => ({
        ...current,
        healthCheckLoading: false,
        healthCheckResult: formatResponseBody(body),
        healthCheckError: errorMessage,
      }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Health check request failed.";
      recordApiResult({
        button: "Test Admin API",
        url: "/api/admin/health",
        status: 0,
        body: { error: message },
        errorMessage: message,
      });
      setState((current) => ({
        ...current,
        healthCheckLoading: false,
        healthCheckResult: null,
        healthCheckError: message,
      }));
    }
  }, [recordAction, recordApiResult]);

  const value = useMemo<AdminActionHealthContextValue>(
    () => ({
      userId,
      userRole,
      serviceRoleConfigured,
      ...state,
      recordAction,
      recordApiResult,
      runHealthCheck,
    }),
    [userId, userRole, serviceRoleConfigured, state, recordAction, recordApiResult, runHealthCheck],
  );

  return <AdminActionHealthContext.Provider value={value}>{children}</AdminActionHealthContext.Provider>;
}

export function useAdminActionHealth() {
  const context = useContext(AdminActionHealthContext);
  if (!context) {
    throw new Error("useAdminActionHealth must be used within AdminActionHealthProvider.");
  }
  return context;
}

/** No-op fallbacks when admin cards render outside the health provider (e.g. partial file restore). */
export function useAdminActionHealthSafe() {
  const context = useContext(AdminActionHealthContext);

  return useMemo(
    () =>
      context ?? {
        userId: "",
        userRole: "",
        serviceRoleConfigured: false,
        lastButtonClicked: null,
        lastApiUrl: null,
        lastHttpStatus: null,
        lastResponseBody: null,
        lastErrorMessage: null,
        healthCheckLoading: false,
        healthCheckResult: null,
        healthCheckError: null,
        recordAction: () => {},
        recordApiResult: () => {},
        runHealthCheck: async () => {},
      },
    [context],
  );
}
