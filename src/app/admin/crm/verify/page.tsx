import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getVerifyStats } from "@/lib/verify/store";
import { providerConfigured } from "@/lib/append/provider";
import { VerifyClient } from "./VerifyClient";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const stats = await getVerifyStats();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Private Market · CRM</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Verify &amp; append</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Clean contacts before spending on them. Cheapest source first: verify the email (syntax + MX), scrape the company site, infer from pattern, and only then use a paid provider. Risky/invalid addresses are held from sends.
          </p>
        </div>
        <VerifyClient stats={stats} providerReady={providerConfigured()} />
      </div>
    </AppShell>
  );
}
