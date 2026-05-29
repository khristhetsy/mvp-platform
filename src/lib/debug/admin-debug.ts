type AdminDebugEntry = {
  scope: string;
  action?: string;
  userId?: string | null;
  userRole?: string | null;
  companyId?: string | null;
  slug?: string | null;
  path?: string;
  payload?: unknown;
  query?: string;
  response?: unknown;
  error?: unknown;
  status?: number;
  usingServiceRole?: boolean;
  exception?: unknown;
  meta?: Record<string, unknown>;
};

export function isAdminDebugEnabled() {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_ADMIN_DEBUG === "true" || process.env.NODE_ENV === "development";
  }

  return process.env.ADMIN_DEBUG === "true" || process.env.NODE_ENV === "development";
}

function serializeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: record.message ?? null,
      details: record.details ?? null,
      hint: record.hint ?? null,
      code: record.code ?? null,
    };
  }
  return { message: String(error) };
}

export function adminDebug(entry: AdminDebugEntry) {
  if (!isAdminDebugEnabled()) {
    return;
  }

  const line = {
    ts: new Date().toISOString(),
    ...entry,
    error: entry.error !== undefined ? serializeError(entry.error) : undefined,
    exception: entry.exception !== undefined ? serializeError(entry.exception) : undefined,
  };

  console.info("[admin-debug]", JSON.stringify(line, null, 2));
}
