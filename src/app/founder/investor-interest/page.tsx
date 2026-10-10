import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { UPGRADE_BASIC_HREF, UPGRADE_PREMIUM_HREF, masksInvestorInterest } from "@/lib/founder-plan/tier";
import { expiryLabel, firstOf, interestHeadline, investorDescriptor } from "@/lib/investor-interest/summary";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
// listing_deal_notices, intro_requests.direction / expires_at are not in the
// generated types yet; same cast the listing code uses.
type Db = any;

type InterestRow = {
  id: string;
  /** Real name and firm. Only ever loaded when the founder's plan shows names. */
  name: string | null;
  firm: string | null;
  descriptor: string | null;
  at: string | null;
  expiresAt: string | null;
  status: string | null;
};

/**
 * Loads the two kinds of interest for one company. When `masked`, investor
 * names and firms are never selected, so they cannot reach the page.
 */
async function loadInterest(companyId: string, masked: boolean): Promise<{ viewed: InterestRow[]; requested: InterestRow[] }> {
  const db: Db = createServiceRoleClient();

  const [{ data: notices }, { data: intros }] = await Promise.all([
    db
      .from("listing_deal_notices")
      .select("id, crm_contact_id, opted_in_at")
      .eq("company_id", companyId)
      .not("opted_in_at", "is", null)
      .order("opted_in_at", { ascending: false })
      .limit(200),
    db
      .from("intro_requests")
      .select("id, investor_id, status, created_at, expires_at, direction")
      .eq("company_id", companyId)
      .eq("direction", "investor_to_founder")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const noticeRows = (notices ?? []) as Array<{ id: string; crm_contact_id: string; opted_in_at: string }>;
  const introRows = (intros ?? []) as Array<{ id: string; investor_id: string; status: string | null; created_at: string; expires_at: string | null }>;

  const contactIds = [...new Set(noticeRows.map((n) => n.crm_contact_id))];
  const investorIds = [...new Set(introRows.map((r) => r.investor_id))];

  const contactCols = masked ? "id, profile" : "id, name, company, profile";
  const [{ data: contacts }, { data: invProfiles }, { data: people }] = await Promise.all([
    contactIds.length ? db.from("crm_contacts").select(contactCols).in("id", contactIds) : Promise.resolve({ data: [] }),
    investorIds.length
      ? db.from("investor_profiles").select(masked ? "profile_id, investor_type, preferred_stages" : "profile_id, investor_type, preferred_stages, firm_name").in("profile_id", investorIds)
      : Promise.resolve({ data: [] }),
    !masked && investorIds.length ? db.from("profiles").select("id, full_name").in("id", investorIds) : Promise.resolve({ data: [] }),
  ]);

  const contactById = new Map<string, Record<string, any>>(((contacts ?? []) as Array<Record<string, any>>).map((c) => [String(c.id), c]));
  const invById = new Map<string, Record<string, any>>(((invProfiles ?? []) as Array<Record<string, any>>).map((p) => [String(p.profile_id), p]));
  const personById = new Map<string, string | null>(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));

  const viewed: InterestRow[] = noticeRows.map((n) => {
    const c = contactById.get(n.crm_contact_id);
    const prof = (c?.profile ?? null) as Record<string, unknown> | null;
    return {
      id: n.id,
      name: masked ? null : ((c?.name as string | null) ?? null),
      firm: masked ? null : ((c?.company as string | null) ?? null),
      descriptor: investorDescriptor(firstOf(prof?.investorTypes), firstOf(prof?.fundingStages)),
      at: n.opted_in_at,
      expiresAt: null,
      status: null,
    };
  });

  const requested: InterestRow[] = introRows.map((r) => {
    const p = invById.get(r.investor_id);
    return {
      id: r.id,
      name: masked ? null : (personById.get(r.investor_id) ?? null),
      firm: masked ? null : ((p?.firm_name as string | null) ?? null),
      descriptor: investorDescriptor((p?.investor_type as string | null) ?? null, firstOf(p?.preferred_stages)),
      at: r.created_at,
      expiresAt: r.expires_at,
      status: r.status,
    };
  });

  return { viewed, requested };
}

function statusLabel(status: string | null): string | null {
  if (!status) return null;
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ row, masked, fallback }: Readonly<{ row: InterestRow; masked: boolean; fallback: string }>) {
  const title = masked ? "Matched investor" : row.name || row.firm || "Investor";
  const sub = masked ? row.descriptor : [row.name && row.firm ? row.firm : null, row.descriptor].filter(Boolean).join(" · ") || null;
  const expiry = masked ? expiryLabel(row.expiresAt) : null;
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF4FE] text-[#1A6CE4]"
          aria-hidden="true"
        >
          <i className={`ti ${masked ? "ti-user-question" : "ti-user"} text-[16px]`} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{sub ?? fallback}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 text-xs text-slate-500 sm:pl-0">
        {row.at ? <span>{formatPlatformDateTime(row.at, { dateStyle: "medium" })}</span> : null}
        {!masked && statusLabel(row.status) ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{statusLabel(row.status)}</span>
        ) : null}
        {expiry ? (
          <span className={`rounded px-2 py-0.5 font-semibold ${expiry === "Expired" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
            {expiry}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default async function FounderInvestorInterestPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const subscription = await getSubscriptionForProfile(profile.id).catch(() => null);
  const masked = masksInvestorInterest(subscription);
  const interest = company ? await loadInterest(company.id, masked) : { viewed: [], requested: [] };
  const headline = interestHeadline(interest.viewed.length, interest.requested.length);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? undefined}>
      <FounderFeatureGate featureKey="dashboard">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Investors"
            title="Investor interest"
            description={headline}
            actions={
              masked ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={UPGRADE_PREMIUM_HREF}
                    className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy)]"
                  >
                    Let us handle it, Premium
                  </Link>
                  <Link href={UPGRADE_BASIC_HREF} className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium">
                    Upgrade to see and connect
                  </Link>
                </div>
              ) : (
                <Link href="/founder/matches" className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium">
                  Go to introductions
                </Link>
              )
            }
          />

          {masked ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Investor names stay hidden on the Free plan. Upgrade to Basic to see who is interested and connect. Introduction
              requests on the Free plan expire after 14 days.
            </p>
          ) : null}

          {!company ? (
            <WorkspacePanel title="Company profile required" subtitle="Investor interest appears once your company is listed.">
              <Link href="/founder/onboarding" className="text-sm font-medium text-[#1A6CE4] hover:text-[#2E78F5]">
                Complete your company profile
              </Link>
            </WorkspacePanel>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <WorkspacePanel
                title="A matched investor viewed your deal"
                subtitle="Investors in our network who opened your deal notice and chose to view your listing."
                action={
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {interest.viewed.length}
                  </span>
                }
              >
                {interest.viewed.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No views yet. Matched investors get a notice once your listing is complete.{" "}
                    <Link href="/founder" className="font-medium text-[#1A6CE4] hover:text-[#2E78F5]">
                      Check your listing
                    </Link>
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {interest.viewed.map((r) => (
                      <Row key={r.id} row={r} masked={masked} fallback="Investor in our network" />
                    ))}
                  </ul>
                )}
              </WorkspacePanel>

              <WorkspacePanel
                title="Requested an introduction"
                subtitle="Investors who asked iCFO to introduce them to your company."
                action={
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {interest.requested.length}
                  </span>
                }
              >
                {interest.requested.length === 0 ? (
                  <p className="text-sm text-slate-600">No introduction requests yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {interest.requested.map((r) => (
                      <Row key={r.id} row={r} masked={masked} fallback="Investor on iCapOS" />
                    ))}
                  </ul>
                )}
              </WorkspacePanel>
            </div>
          )}

          <p className="text-[11px] leading-5 text-slate-500">
            Interest is not a commitment to invest. iCFO Capital does not solicit securities and is not an investment adviser.
            Content is for educational purposes only.
          </p>
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
