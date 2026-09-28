import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { EMAIL_ROLES, getEmailLog, listEmailLog, type EmailLogFilter, type EmailRole } from "@/lib/email/email-log";

export const dynamic = "force-dynamic";

const FILTERS: EmailLogFilter[] = ["all", "failed", "bounced", "opened", "unopened"];

/**
 * The platform email log (Admin, Activity, Sent). Staff only.
 * GET ?id=123   one email in full, with its body.
 * GET ?role=founder|investor|staff|external&filter=failed|bounced|opened|unopened
 *     &q=text&user=<profile id>&days=30&before=<id>   a page of sends, newest first.
 */
export async function GET(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const p = new URL(request.url).searchParams;
  if (p.get("id")) {
    const id = Number(p.get("id"));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const email = await getEmailLog(id);
    return email ? NextResponse.json({ email }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const role = p.get("role");
  const filter = p.get("filter");
  const user = p.get("user");
  const days = Number(p.get("days") ?? 30);
  const before = Number(p.get("before") ?? 0);
  const result = await listEmailLog({
    role: role && (EMAIL_ROLES as string[]).includes(role) ? (role as EmailRole) : null,
    filter: filter && (FILTERS as string[]).includes(filter) ? (filter as EmailLogFilter) : "all",
    q: (p.get("q") ?? "").slice(0, 120) || null,
    userId: user && /^[0-9a-f-]{36}$/i.test(user) ? user : null,
    days: Number.isFinite(days) ? Math.min(Math.max(days, 1), 180) : 30,
    before: Number.isInteger(before) && before > 0 ? before : null,
    limit: Number(p.get("limit") ?? 100) || 100,
  });
  return NextResponse.json(result);
}
