import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { emailConfigured } from "@/lib/marketing/send";

export const dynamic = "force-dynamic";

// GET — surface why marketing emails are (not) sending, based on the most recent
// failed send errors, so the cause shows in-app instead of only in the DB.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const issues: Array<{ kind: string; message: string; severity: "blocker" | "warning" }> = [];
  if (!emailConfigured()) {
    issues.push({ kind: "no_key", message: "No email provider is configured. Set RESEND_API_KEY in the environment.", severity: "blocker" });
    return NextResponse.json({ healthy: false, issues });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await db.from("marketing_events")
      .select("email, metadata, occurred_at")
      .eq("event_type", "failed")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(200);

    const rows = (data ?? []) as Array<{ email: string | null; metadata: { error?: string } | null }>;

    let badKey = false;
    const unverified = new Set<string>();
    const badRecipients = new Set<string>();
    for (const r of rows) {
      const e = String(r.metadata?.error ?? "");
      if (!e) continue;
      const l = e.toLowerCase();
      if (l.includes("access token") || l.includes("api key")) badKey = true;
      const m = e.match(/The ([\w.-]+) domain is not verified/i);
      if (m) unverified.add(m[1]);
      if (l.includes("`to` field") || l.includes("invalid recipient")) badRecipients.add(r.email ?? "");
    }

    if (badKey) issues.push({ kind: "invalid_key", message: "Resend rejected the API key (invalid or malformed). Set a valid RESEND_API_KEY in your hosting environment and redeploy.", severity: "blocker" });
    if (unverified.size) issues.push({ kind: "unverified_domain", message: `Sending domain not verified: ${[...unverified].join(", ")}. Verify the domain in Resend (SPF, DKIM, DMARC), then send from a verified address.`, severity: "blocker" });
    // A malformed contact address is a data problem on that one contact, not a
    // delivery outage, so it is reported as a warning and never marks sending unhealthy.
    // Only count contacts that still carry the bad address; once a record is fixed its
    // old failures stop showing.
    let stillBad = 0;
    if (badRecipients.size) {
      const { data: live } = await db.from("marketing_contacts").select("email").in("email", [...badRecipients].filter(Boolean));
      stillBad = new Set(((live ?? []) as Array<{ email: string }>).map((c) => c.email)).size;
    }
    if (stillBad) {
      const n = stillBad;
      issues.push({ kind: "bad_recipient", severity: "warning", message: `${n} contact${n === 1 ? " has" : "s have"} an invalid email address and ${n === 1 ? "was" : "were"} skipped in the last 30 days. Fix the address on the contact record.` });
    }

    return NextResponse.json({ healthy: !issues.some((i) => i.severity === "blocker"), issues });
  } catch {
    return NextResponse.json({ healthy: true, issues: [] });
  }
}
