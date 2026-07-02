import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { AdminProfileClient } from "@/components/admin/AdminProfileClient";
import { SignatureSettings } from "@/components/email/SignatureSettings";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("adminPages");
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">{t("adminWorkspace")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t("profileP")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage your account information, password, and view your authorized platform modules.
        </p>
      </div>

      <AdminProfileClient
        initialName={profile.full_name}
        email={profile.email}
        role={profile.role}
        isSuperAdmin={profile.is_super_admin ?? false}
        createdAt={profile.created_at}
      />

      <div className="mt-6">
        <SignatureSettings />
      </div>
    </AppShell>
  );
}
