import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listProposals } from "@/lib/fit/enrich-investors";
import { EnrichClient } from "./EnrichClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor enrichment" };

export default async function InvestorEnrichPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const initial = await listProposals("pending").catch(() => []);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor enrichment" profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Investor enrichment</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Backfill missing industry &amp; type with AI from company name and email domain. Nothing counts in matching until you approve it — approved values are marked <span className="font-medium">inferred</span> and never overwrite verified or self-reported data.</p>
        <div className="mt-5"><EnrichClient initial={initial} /></div>
      </div>
    </AppShell>
  );
}
