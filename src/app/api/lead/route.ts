import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
  start_choice: z.enum(["rating_only", "rating_plus_plan"]).optional(),
  source_page: z.string().max(200).optional(),
  utm: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    await admin.from("marketing_site_leads").insert({
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
    });
  } catch {
    // Non-fatal — still hand off to auth so the founder isn't blocked.
  }

  // Hand off to existing auth (spec §15); does not reimplement it.
  const redirect = `/auth/sign-up?email=${encodeURIComponent(parsed.data.email)}&role=founder`;
  return NextResponse.json({ ok: true, redirect });
}
