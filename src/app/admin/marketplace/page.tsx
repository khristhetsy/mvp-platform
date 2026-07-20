import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAllowlistedPortalUrl } from "@/lib/marketplace/portal-allowlist";
import { ListingReviewRow, type ReviewListing } from "@/components/admin/marketplace/ListingReviewRow";
import { NotifyInterestButton } from "@/components/admin/marketplace/NotifyInterestButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  company_name: string;
  brief_description: string;
  industry: string | null;
  location: string | null;
  security_type: string | null;
  portal_name: string;
  portal_url: string;
  created_at: string;
};

export default async function AdminMarketplaceReviewPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const { data } = await admin
    .from("marketplace_listings")
    .select("id, company_name, brief_description, industry, location, security_type, portal_name, portal_url, created_at")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(200);

  // Live listings + interest counts (for the "offering is live" notification).
  const { data: liveData } = await admin
    .from("marketplace_listings")
    .select("id, company_name, portal_name")
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(200);
  const liveRows = (liveData ?? []) as Array<{ id: string; company_name: string; portal_name: string }>;
  const interestByListing = new Map<string, number>();
  if (liveRows.length > 0) {
    const { data: interest } = await admin
      .from("listing_interest")
      .select("listing_id")
      .in("listing_id", liveRows.map((l) => l.id))
      .limit(10000);
    for (const r of (interest ?? []) as Array<{ listing_id: string }>) {
      interestByListing.set(r.listing_id, (interestByListing.get(r.listing_id) ?? 0) + 1);
    }
  }

  const listings: ReviewListing[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    companyName: r.company_name,
    briefDescription: r.brief_description,
    industry: r.industry,
    location: r.location,
    securityType: r.security_type,
    portalName: r.portal_name,
    portalUrl: r.portal_url,
    portalFlagged: (() => {
      const p = isAllowlistedPortalUrl(r.portal_url);
      return p.https && !p.allowlisted;
    })(),
    createdAt: r.created_at,
  }));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Marketplace"
          title="Listing review queue"
          description="Approve or reject Reg CF listings before they go live. AI may pre-screen; a human always decides."
        />
        <WorkspacePanel title="Pending review" subtitle={`${listings.length} awaiting review`}>
          {listings.length === 0 ? (
            <p className="text-sm text-slate-500">No listings awaiting review.</p>
          ) : (
            <div className="grid gap-3">
              {listings.map((l) => (
                <ListingReviewRow key={l.id} listing={l} />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          title="Live listings"
          subtitle="Notify interested parties when an offering goes live on its portal (email counsel-gated)"
        >
          {liveRows.length === 0 ? (
            <p className="text-sm text-slate-500">No live listings.</p>
          ) : (
            <div className="grid gap-3">
              {liveRows.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{l.company_name}</p>
                    <p className="text-xs text-slate-500">Portal: {l.portal_name}</p>
                  </div>
                  <NotifyInterestButton listingId={l.id} interestCount={interestByListing.get(l.id) ?? 0} />
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePageContainer>
    </AppShell>
  );
}
