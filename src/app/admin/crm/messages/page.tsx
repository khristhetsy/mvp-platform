import { AppShell } from "@/components/AppShell";
import { AdminMessageThreadsPanel } from "@/components/AdminMessageThreadsPanel";
import { formatError } from "@/lib/errors/format-error";
import { listAdminMessageThreads } from "@/lib/messaging/threads";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminCrmMessagesPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("irAdmin.crm");

  let setupError: string | null = null;
  let messageThreads: Awaited<ReturnType<typeof listAdminMessageThreads>>["data"] = [];

  try {
    const supabase = createServiceRoleClient();
    const result = await listAdminMessageThreads(supabase, 30);
    messageThreads = result.data ?? [];
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("messages")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {t("messagesDesc")}
        </p>
      </div>

      {setupError ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Data load failed: {setupError}
        </div>
      ) : null}

      <AdminMessageThreadsPanel threads={messageThreads} />
    </AppShell>
  );
}
