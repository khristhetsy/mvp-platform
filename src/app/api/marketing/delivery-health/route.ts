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

  const issues: Array<{ kind: string; message: string }> = [];
  if (!emailConfigured()) {
    issues.push({ kind: "no_key", message: "No email provider is configured — set RESEND_API_KEY in the environment." });
    return NextResponse.json({ healthy: false, issues });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await db.from("marketing_events")
      .select("metadata, created_at")
      .eq("event_type", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    const errors = ((data ?? []) as Array<{ metadata: { error?: string } | null }>)
      .map((r) => String(r.metadata?.error ?? "")).filter(Boolean);

    let badKey = false;
    const unverified = new Set<string>();
    let badRecipient = false;
    for (const e of errors) {
      const l = e.toLowerCase();
      if (l.includes("access token") || l.includes("api key")) badKey = true;
      const m = e.match(/The ([\w.-]+) domain is not verified/i);
      if (m) unverified.add(m[1]);
      if (l.includes("`to` field") || l.includes("recipient")) badRecipient = true;
    }

    if (badKey) issues.push({ kind: "invalid_key", message: "Resend rejected the API key (invalid or malformed). Set a valid RESEND_API_KEY in your hosting environment and redeploy." });
    if (unverified.size) issues.push({ kind: "unverified_domain", message: `Sending domain not verified: ${[...unverified].join(", ")}. Verify the domain in Resend (SPF, DKIM, DMARC), then send from a verified address.` });
    if (badRecipient) issues.push({ kind: "bad_recipient", message: "Some recipient addresses were invalid and were skipped." });

    return NextResponse.json({ healthy: issues.length === 0, issues });
  } catch {
    return NextResponse.json({ healthy: true, issues: [] });
  }
}
