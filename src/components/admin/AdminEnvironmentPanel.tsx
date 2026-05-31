import type { EnvironmentStatusSummary } from "@/lib/env";
import { WorkspacePanel } from "@/components/WorkspacePanel";

function StatusRow({
  label,
  value,
  ok,
  detail,
}: Readonly<{ label: string; value: string; ok?: boolean; detail?: string }>) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={ok === false ? "font-medium text-amber-800" : "text-slate-700"}>{value}</span>
      {detail ? <span className="w-full text-xs text-slate-500">{detail}</span> : null}
    </li>
  );
}

export function AdminEnvironmentPanel({
  status,
}: Readonly<{ status: EnvironmentStatusSummary }>) {
  return (
    <WorkspacePanel
      title="Environment status"
      subtitle="Deployment tier and configuration — secrets are never displayed"
    >
      <ul className="space-y-2">
        <StatusRow label="APP_ENV" value={status.appEnv} />
        <StatusRow label="NODE_ENV" value={status.nodeEnv ?? "—"} />
        <StatusRow label="VERCEL_ENV" value={status.vercelEnv ?? "—"} />
        <StatusRow label="App URL" value={status.appUrl ?? "Not set"} />
        <StatusRow
          label="Supabase project host"
          value={status.supabaseProjectHost ?? "Not configured"}
          ok={status.supabasePublicConfigured}
        />
        <StatusRow
          label="Service role key"
          value={status.serviceRoleConfigured ? "Configured" : "Missing"}
          ok={status.serviceRoleConfigured}
          detail="Presence only — value is never shown"
        />
        <StatusRow
          label="Env validation"
          value={status.envValidationOk ? "Required keys present" : "Missing required keys"}
          ok={status.envValidationOk}
          detail={status.missingEnvKeys.length ? `Missing: ${status.missingEnvKeys.join(", ")}` : undefined}
        />
      </ul>

      {status.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Run <code className="rounded bg-slate-100 px-1">npm run check:env</code> locally. See{" "}
        <code className="rounded bg-slate-100 px-1">docs/environments.md</code>.
      </p>
    </WorkspacePanel>
  );
}
