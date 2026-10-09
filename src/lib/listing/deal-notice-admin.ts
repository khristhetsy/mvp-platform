/**
 * Staff view of deal notices (Marketing > Deal notices) and partner codes
 * (Marketing > Partner codes). Server only, service role reads after the
 * route's staff check.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { normalizePartnerCode } from "@/lib/listing/claim";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export type NoticeRow = {
  company_id: string;
  status: "queued" | "sent" | "skipped" | "failed";
  viewed_at: string | null;
  opted_in_at: string | null;
};

export type NoticeCounts = {
  total: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  viewed: number;
  optedIn: number;
};

export type CompanyNoticeStats = NoticeCounts & {
  companyId: string;
  companyName: string;
  listedAt: string | null;
};

const zero = (): NoticeCounts => ({ total: 0, queued: 0, sent: 0, skipped: 0, failed: 0, viewed: 0, optedIn: 0 });

function add(c: NoticeCounts, r: NoticeRow) {
  c.total++;
  if (r.status === "queued") c.queued++;
  else if (r.status === "sent") c.sent++;
  else if (r.status === "skipped") c.skipped++;
  else if (r.status === "failed") c.failed++;
  if (r.viewed_at) c.viewed++;
  if (r.opted_in_at) c.optedIn++;
}

/**
 * Pure: totals and one row per company. Every listed company appears, even
 * with no notices yet (no investor matched, or not queued), newest listing first.
 */
export function aggregateDealNotices(
  notices: NoticeRow[],
  companies: Array<{ id: string; company_name: string | null; listing_completed_at: string | null }>,
): { totals: NoticeCounts; companies: CompanyNoticeStats[] } {
  const totals = zero();
  const byCompany = new Map<string, NoticeCounts>();
  for (const n of notices) {
    add(totals, n);
    const c = byCompany.get(n.company_id) ?? zero();
    add(c, n);
    byCompany.set(n.company_id, c);
  }
  const meta = new Map(companies.map((c) => [c.id, c]));
  const ids = new Set<string>([...companies.map((c) => c.id), ...byCompany.keys()]);
  const rows: CompanyNoticeStats[] = [...ids].map((id) => ({
    companyId: id,
    companyName: meta.get(id)?.company_name?.trim() || "Unknown company",
    listedAt: meta.get(id)?.listing_completed_at ?? null,
    ...(byCompany.get(id) ?? zero()),
  }));
  rows.sort((a, b) => (b.listedAt ?? "").localeCompare(a.listedAt ?? "") || a.companyName.localeCompare(b.companyName));
  return { totals, companies: rows };
}

/** Reads every notice in pages of 1,000 (PostgREST caps a single read). */
async function allNotices(db: Db): Promise<NoticeRow[]> {
  const out: NoticeRow[] = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    const { data, error } = await db
      .from("listing_deal_notices")
      .select("company_id, status, viewed_at, opted_in_at")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`Could not load deal notices: ${error.message}`);
    const rows = (data ?? []) as NoticeRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export async function loadDealNoticeStats(db: Db = createServiceRoleClient()) {
  const notices = await allNotices(db);
  const noticeCompanyIds = [...new Set(notices.map((n) => n.company_id))];
  const [{ data: listed, error: listedError }, { data: noticed }] = await Promise.all([
    db
      .from("companies")
      .select("id, company_name, listing_completed_at")
      .not("listing_completed_at", "is", null)
      .order("listing_completed_at", { ascending: false })
      .limit(2000),
    noticeCompanyIds.length
      ? db.from("companies").select("id, company_name, listing_completed_at").in("id", noticeCompanyIds.slice(0, 1000))
      : Promise.resolve({ data: [] }),
  ]);
  if (listedError) throw new Error(`Could not load listed companies: ${listedError.message}`);
  const companies = new Map<string, { id: string; company_name: string | null; listing_completed_at: string | null }>();
  for (const c of [...(listed ?? []), ...(noticed ?? [])]) companies.set(c.id, c);
  return { ...aggregateDealNotices(notices, [...companies.values()]), loadedAt: new Date().toISOString() };
}

// ─── Partner codes ───────────────────────────────────────────────────────────

export type PartnerCodeRow = {
  id: string;
  code: string;
  partnerName: string;
  isActive: boolean;
  createdAt: string;
  claims: number;
  complete: number;
};

export function partnerSignUpLink(code: string, appUrl = "https://icapos.com"): string {
  return `${appUrl}/auth/sign-up?role=founder&plan=founder_free&ref=${encodeURIComponent(code)}`;
}

/** Pure: validates the New code form. */
export function validateNewPartnerCode(input: { partnerName?: unknown; code?: unknown }):
  | { ok: true; partnerName: string; code: string }
  | { ok: false; error: string } {
  const partnerName = typeof input.partnerName === "string" ? input.partnerName.trim() : "";
  if (!partnerName) return { ok: false, error: "Partner name is required." };
  if (partnerName.length > 120) return { ok: false, error: "Partner name is too long (120 characters at most)." };
  const code = normalizePartnerCode(input.code);
  if (!code) return { ok: false, error: "Code must be 3 to 20 letters or digits." };
  return { ok: true, partnerName, code };
}

export async function listPartnerCodes(db: Db = createServiceRoleClient()): Promise<PartnerCodeRow[]> {
  const { data: codes, error } = await db
    .from("partner_codes")
    .select("id, code, partner_name, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load partner codes: ${error.message}`);
  const list = (codes ?? []) as Array<{ id: string; code: string; partner_name: string; is_active: boolean; created_at: string }>;
  // Exact counts per code (head requests), so the totals stay right past the
  // 1,000 row cap a plain select would hit.
  return Promise.all(
    list.map(async (c) => {
      const [{ count: claims }, { count: complete }] = await Promise.all([
        db.from("lead_claims").select("id", { count: "exact", head: true }).eq("partner_code", c.code),
        db.from("companies").select("id", { count: "exact", head: true }).eq("partner_code", c.code).not("listing_completed_at", "is", null),
      ]);
      return {
        id: c.id,
        code: c.code,
        partnerName: c.partner_name,
        isActive: c.is_active,
        createdAt: c.created_at,
        claims: claims ?? 0,
        complete: complete ?? 0,
      };
    }),
  );
}
