import type { OperationalSystemSnapshot } from "@/lib/operations/system-snapshot";

function StatusRow({
  label,
  ok,
  detail,
}: Readonly<{ label: string; ok: boolean; detail?: string }>) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={ok ? "text-emerald-700" : "text-amber-800"}>{ok ? "OK" : "Action needed"}</span>
      {detail ? <span className="w-full text-xs text-slate-500">{detail}</span> : null}
    </li>
  );
}

export function AdminRecoveryChecklist({
  snapshot,
}: Readonly<{ snapshot: OperationalSystemSnapshot }>) {
  const allRequiredBuckets = Object.values(snapshot.storage.requiredBucketsPresent).every(Boolean);
  const latestMigration = snapshot.migrations.latest ?? "unknown";
  const lastBackup = snapshot.backup.lastEvents[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="text-lg font-semibold text-slate-950">Backup &amp; recovery checklist</h2>
      <p className="mt-2 text-sm text-slate-600">
        Internal operational view. No secrets are shown. See{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">docs/backup-and-recovery.md</code> for runbooks.
      </p>

      <ul className="mt-4 space-y-2">
        <StatusRow
          label="Latest repo migration file"
          ok={snapshot.migrations.total > 0}
          detail={`${latestMigration} (${snapshot.migrations.total} files in repo)`}
        />
        <StatusRow
          label="Supabase public env"
          ok={snapshot.environment.supabasePublicConfigured}
          detail={snapshot.environment.supabaseProjectHost ?? "not configured"}
        />
        <StatusRow
          label="Service role configured"
          ok={snapshot.environment.serviceRoleConfigured}
        />
        <StatusRow
          label="DATABASE_URL (backup scripts)"
          ok={snapshot.environment.databaseUrlConfigured}
          detail="Required for scripts/backup-db.sh"
        />
        <StatusRow
          label="Required storage buckets"
          ok={allRequiredBuckets}
          detail={JSON.stringify(snapshot.storage.requiredBucketsPresent)}
        />
        <StatusRow
          label="Google OAuth env"
          ok={snapshot.integrations.googleOAuthConfigured}
          detail={`${snapshot.integrations.googleConnectedAccounts} connected account(s)`}
        />
        <StatusRow
          label="Recent backup audit event"
          ok={!snapshot.backup.verificationRecommended}
          detail={
            lastBackup
              ? `${lastBackup.action} at ${lastBackup.createdAt}`
              : "No backup events in audit_logs yet"
          }
        />
      </ul>

      {snapshot.backup.lastEvents.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent backup events</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {snapshot.backup.lastEvents.slice(0, 5).map((event) => (
              <li key={`${event.action}-${event.createdAt}`}>
                {event.createdAt} — {event.action}
                {event.level ? ` (${event.level})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
