import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { CREDITS_ENABLED, getBalance, getLedger, listCatalog, reasonLabel } from "@/lib/icfo-events/credits";
import { CreditsWallet } from "@/components/events/CreditsWallet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "iCFO Points", robots: { index: false } };

export default async function CreditsPage() {
  if (!CREDITS_ENABLED) notFound();
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) redirect("/auth/sign-in?next=/credits");

  const supabase = await createServerSupabaseClient();
  const [balance, ledger, catalog] = await Promise.all([
    getBalance(supabase, profile.id),
    getLedger(supabase, profile.id),
    listCatalog(supabase, true),
  ]);

  const history = ledger.map((e) => ({
    id: e.id,
    delta: e.delta,
    label: e.reason === "redeem" ? "Redeemed a reward" : reasonLabel(e.reason),
    createdAt: e.createdAt,
  }));

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-[var(--navy)]">iCFO Points</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Earn Points for participating in iCFO events and community — redeem them for iCFO services.
        </p>
        <div className="mt-6">
          <CreditsWallet initialBalance={balance} catalog={catalog} history={history} />
        </div>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
