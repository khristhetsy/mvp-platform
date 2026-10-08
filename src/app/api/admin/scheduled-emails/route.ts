/**
 * Scheduled emails (Sales › Scheduled emails, and the pending notices on each send point).
 *   GET ?status=scheduled|sent|failed|canceled|all&q=&page=&limit=&kind=&contextKey=
 *     → { rows, total, page, pageSize } — the signed in person's own scheduled emails.
 *   limit: page size, 50 by default, up to 1000 (the list page filters client side).
 */
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { db } from "@/lib/scheduled-emails/schedule";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUSES = new Set(["scheduled", "sending", "sent", "failed", "canceled"]);

export async function GET(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "scheduled";
  const q = (url.searchParams.get("q") ?? "").trim().replace(/[,%()]/g, " ").slice(0, 100);
  const kind = url.searchParams.get("kind");
  const contextKey = url.searchParams.get("contextKey");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || PAGE_SIZE));

  let query = db()
    .from("scheduled_emails")
    .select("id, kind, to_label, subject, context_key, send_at, status, attempts, sent_at, error, created_at", { count: "exact" })
    .eq("created_by", auth.profile.id);
  if (status === "scheduled") query = query.in("status", ["scheduled", "sending"]);
  else if (STATUSES.has(status)) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  if (contextKey) query = query.eq("context_key", contextKey);
  if (q) query = query.or(`to_label.ilike.%${q}%,subject.ilike.%${q}%`);
  query = status === "scheduled" ? query.order("send_at", { ascending: true }) : query.order("send_at", { ascending: false });
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) {
    const missing = error.message.includes("scheduled_emails");
    return NextResponse.json({ error: missing ? "Scheduling isn't set up yet: run the scheduled_emails SQL in Supabase." : error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
}
