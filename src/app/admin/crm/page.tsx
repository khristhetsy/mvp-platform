import { AppShell } from "@/components/AppShell";
import { AdminInvestorCrmTimeline } from "@/components/AdminInvestorCrmTimeline";
import { formatError } from "@/lib/errors/format-error";
import { listRecentInvestorCrmActivity } from "@/lib/data/investor-crm";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminCrmPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("irAdmin.crm");

  let setupError: string | null = null;
  let crmActivity: Awaited<ReturnType<typeof listRecentInvestorCrmActivity>> = [];

  try {
    const supabase = createServiceRoleClient();
    crmActivity = await listRecentInvestorCrmActivity(supabase);
  } catch (error) {
    setupError = formatError(error);
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("activity")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {t("activityDesc")}
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t("dataLoadFailed", { error: setupError })}
        </div>
      ) : null}

      <AdminInvestorCrmTimeline activities={crmActivity} canDelete={profile.role === "admin"} />
    </AppShell>
  );
}
