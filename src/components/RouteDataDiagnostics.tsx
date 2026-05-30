type DiagnosticEntry = {
  dataFunction: string;
  count: number | null;
  error: string | null;
  note?: string | null;
};

export function RouteDataDiagnostics({
  route,
  userId,
  profileRole,
  companyId,
  entries,
}: Readonly<{
  route: string;
  userId: string;
  profileRole: string;
  companyId?: string | null;
  entries: DiagnosticEntry[];
}>) {
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-950">
      <p className="font-sans text-sm font-semibold">DATA PATH DIAGNOSTICS (temporary)</p>
      <p className="mt-2">Route: {route}</p>
      <p>User ID: {userId}</p>
      <p>Profile role: {profileRole}</p>
      {companyId !== undefined ? <p>Company ID: {companyId ?? "null"}</p> : null}
      {entries.map((entry) => (
        <div key={entry.dataFunction} className="mt-3 border-t border-amber-200 pt-3">
          <p>Data function: {entry.dataFunction}</p>
          <p>Record count: {entry.count === null ? "n/a" : entry.count}</p>
          <p className={entry.error ? "font-semibold text-red-700" : ""}>
            Supabase error: {entry.error ?? "none"}
          </p>
          {entry.note ? <p className="mt-1 text-amber-900">Note: {entry.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function formatError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export { formatError };
