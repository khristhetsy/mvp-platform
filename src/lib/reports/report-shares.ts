/**
 * Diligence report share links ("Use your report with any investor").
 *
 * A founder creates a secure link to their latest AI diligence report and
 * sends it to any prospective investor. The public page reads through the
 * service role by token only; views and downloads are counted per link, and a
 * founder can turn a link off at any time (revoked_at).
 */
import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { DiligenceReportRow } from "@/lib/reports/diligence-report-pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */
// diligence_report_shares / _share_views are not in the generated types yet.
type Db = any;

export type ShareRow = {
  id: string;
  token: string;
  label: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type ShareViewRow = { share_id: string; action: "view" | "download"; viewed_at: string };

export type ShareSummary = ShareRow & {
  views: number;
  downloads: number;
  lastOpenedAt: string | null;
};

/** 24 random bytes, url safe: 32 characters nobody can guess. */
export function newShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** A token is only ever our own base64url output; reject anything else early. */
export function isPlausibleShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

/**
 * Views and downloads per link, plus the last time it was opened (a view or a
 * download). Pure, so the counting rule is tested without a database.
 */
export function summarizeShares(shares: ShareRow[], views: ShareViewRow[]): ShareSummary[] {
  const by = new Map<string, { views: number; downloads: number; last: string | null }>();
  for (const v of views) {
    const cur = by.get(v.share_id) ?? { views: 0, downloads: 0, last: null };
    if (v.action === "download") cur.downloads += 1;
    else cur.views += 1;
    if (!cur.last || v.viewed_at > cur.last) cur.last = v.viewed_at;
    by.set(v.share_id, cur);
  }
  return shares.map((s) => {
    const c = by.get(s.id);
    return { ...s, views: c?.views ?? 0, downloads: c?.downloads ?? 0, lastOpenedAt: c?.last ?? null };
  });
}

/** Every link for one company, newest first, with its counts. */
export async function listShareSummaries(companyId: string, db: Db = createServiceRoleClient()): Promise<ShareSummary[]> {
  const { data: shares } = await db
    .from("diligence_report_shares")
    .select("id, token, label, revoked_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  const rows = (shares ?? []) as ShareRow[];
  if (!rows.length) return [];
  const { data: views } = await db
    .from("diligence_report_share_views")
    .select("share_id, action, viewed_at")
    .in("share_id", rows.map((r) => r.id));
  return summarizeShares(rows, (views ?? []) as ShareViewRow[]);
}

export type SharedReport = {
  shareId: string;
  companyName: string;
  report: DiligenceReportRow & { created_at: string };
};

/**
 * The latest diligence report behind an ACTIVE link. Null for an unknown or
 * revoked token, or a company with no report, so every failure reads the
 * same to the public ("This link is no longer active").
 */
export async function loadSharedReport(token: string): Promise<SharedReport | null> {
  if (!isPlausibleShareToken(token)) return null;
  const db: Db = createServiceRoleClient();
  const { data: share } = await db
    .from("diligence_report_shares")
    .select("id, company_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!share || share.revoked_at) return null;

  const [{ data: company }, { data: report }] = await Promise.all([
    db.from("companies").select("company_name").eq("id", share.company_id).maybeSingle(),
    db
      .from("diligence_reports")
      .select("executive_summary, business_overview, financial_review, market_review, legal_review, team_review, risk_flags, missing_documents, readiness_score, recommendations, created_at")
      .eq("company_id", share.company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!report) return null;
  return {
    shareId: share.id as string,
    companyName: (company?.company_name as string | undefined) ?? "Company",
    report: report as DiligenceReportRow & { created_at: string },
  };
}

/** Counts one open of a link. Best effort: a failed count never blocks the page. */
export async function recordShareView(shareId: string, action: "view" | "download"): Promise<void> {
  try {
    const db: Db = createServiceRoleClient();
    await db.from("diligence_report_share_views").insert({ share_id: shareId, action });
  } catch (err) {
    console.error("[report-share] could not record view", err);
  }
}
