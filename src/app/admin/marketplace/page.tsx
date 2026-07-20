import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAllowlistedPortalUrl } from "@/lib/marketplace/portal-allowlist";
import { ListingReviewRow, type ReviewListing } from "@/components/admin/marketplace/ListingReviewRow";

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
      </WorkspacePageContainer>
    </AppShell>
  );
}
