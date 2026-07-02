import { useTranslations } from "next-intl";
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
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel
      title={t("environment_status")}
      subtitle={t("deployment_tier_and_configuration_secrets_ar")}
    >
      <ul className="space-y-2">
        <StatusRow label={t("app_env")} value={status.appEnv} />
        <StatusRow label={t("node_env")} value={status.nodeEnv ?? "—"} />
        <StatusRow label={t("vercel_env")} value={status.vercelEnv ?? "—"} />
        <StatusRow label={t("app_url")} value={status.appUrl ?? "Not set"} />
        <StatusRow
          label={t("supabase_project_host")}
          value={status.supabaseProjectHost ?? "Not configured"}
          ok={status.supabasePublicConfigured}
        />
        <StatusRow
          label={t("service_role_key")}
          value={status.serviceRoleConfigured ? "Configured" : "Missing"}
          ok={status.serviceRoleConfigured}
          detail="Presence only — value is never shown"
        />
        <StatusRow
          label={t("env_validation")}
          value={status.envValidationOk ? "Required keys present" : "Missing required keys"}
          ok={status.envValidationOk}
          detail={status.missingEnvKeys.length ? `Missing: ${status.missingEnvKeys.join(", ")}` : undefined}
        />
      </ul>

      {status.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">{t("warnings")}</p>
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
