import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { GoogleCalendarConnectionCard } from "@/components/GoogleCalendarConnectionCard";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorSettingsPage() {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const googleStatus = await getGoogleConnectionStatus(supabase, investorId);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Manage integrations and preferences for your investor workspace.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading Google connection…</p>}>
          <GoogleCalendarConnectionCard status={googleStatus} returnPath="/investor/settings" />
        </Suspense>
      </section>
    </AppShell>
  );
}
