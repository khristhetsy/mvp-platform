import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getEmailLog, type EmailLogDetail } from "@/lib/email/email-log";
import { loadReceived } from "@/lib/admin/investor-reach";

export const dynamic = "force-dynamic";

/**
 * The View window for one Investor reach row: the emails actually sent (full
 * body, delivery and opens) and the replies actually received. Staff only.
 * GET ?ids=12,15&email=investor@firm.com&since=<iso>
 */
export async function GET(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const p = new URL(request.url).searchParams;
  const ids = (p.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 12);
  const email = (p.get("email") ?? "").slice(0, 320);
  const sinceRaw = p.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;

  const sent = (await Promise.all(ids.map((id) => getEmailLog(id)))).filter((e): e is EmailLogDetail => Boolean(e));
  // Only emails to this investor: the ids come from the page, so check them.
  const mine = email ? sent.filter((e) => e.toEmail.trim().toLowerCase() === email.trim().toLowerCase()) : sent;
  const received = email.includes("@") ? await loadReceived(email, since) : [];
  return NextResponse.json({ sent: mine, received });
}
