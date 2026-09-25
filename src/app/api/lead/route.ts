import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

/**
 * Marketing signup intake (spec §3, §8). Writes a marketing_site_leads row via
 * the service role after validation, then hands off to existing auth — it does
 * NOT reimplement auth. Anon can never read the leads table.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().max(320),
  company: z.string().max(200).optional(),
  website: z.string().max(500).optional(),
  stage: z.string().max(60).optional(),
  raise_target: z.string().max(60).optional(),
  capital_structure: z.enum(["reg_d", "reg_cf", "reg_a_plus", "not_sure"]).optional(),
  // Founders pick a paid plan (free was discontinued 16 Sep 2026); investors sign up free.
  start_choice: z.enum(["founder_basic", "founder_professional", "investor"]).optional(),
  role: z.enum(["founder", "investor"]).optional(),
  details: z.record(z.string(), z.union([z.string().max(200), z.array(z.string().max(80)).max(20)])).optional(),
  source_page: z.string().max(200).optional(),
  utm: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { data: lead } = await admin.from("marketing_site_leads").insert({
      name: parsed.data.name ?? null,
      email: parsed.data.email,
      company: parsed.data.company ?? null,
      website: parsed.data.website ?? null,
      stage: parsed.data.stage ?? null,
      raise_target: parsed.data.raise_target ?? null,
      capital_structure: parsed.data.capital_structure ?? null,
      start_choice: parsed.data.start_choice ?? null,
      source_page: parsed.data.source_page ?? null,
      utm: parsed.data.utm ?? null,
    }).select("id").maybeSingle();
    // Role and investor details go in separate columns added by migration
    // 20260925002. Written best-effort so a missing column never loses the lead.
    if (lead?.id && (parsed.data.role || parsed.data.details)) {
      await admin
        .from("marketing_site_leads")
        .update({ role: parsed.data.role ?? null, details: parsed.data.details ?? null })
        .eq("id", lead.id);
    }
  } catch {
    // Non-fatal — still hand off to auth so the founder isn't blocked.
  }

  // Founder signup from someone who walked /fit in the last 30 days (fs_session cookie).
  // Investor signups share this route and are skipped. Best-effort: recordFunnelEvent never throws.
  const fitSessionId = req.cookies.get("fs_session")?.value;
  if (fitSessionId && parsed.data.role !== "investor") await recordFunnelEvent({ sessionId: fitSessionId, eventName: "fit_signup", properties: { source_page: parsed.data.source_page ?? null, start_choice: parsed.data.start_choice ?? null } });

  // Hand off to existing auth (spec §15); does not reimplement it.
  const email = encodeURIComponent(parsed.data.email);
  const isInvestor = parsed.data.role === "investor" || parsed.data.start_choice === "investor";
  // The account form opens on the right role, and for founders on the plan they picked.
  const plan = parsed.data.start_choice === "founder_professional" ? "founder_professional" : "founder_basic";
  const redirect = isInvestor
    ? `/auth/sign-up?email=${email}&role=investor`
    : `/auth/sign-up?email=${email}&role=founder&plan=${plan}`;
  return NextResponse.json({ ok: true, redirect });
}
