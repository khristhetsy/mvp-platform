// Agent tools. These are the differentiating layer — the guardrailed brain's
// hands. mark_opt_out is a real compliance action (DNC + revoke consent) and
// always works. schedule_demo / request_human_transfer log intent; the actual
// booking + transfer wire in with the vendor (Cal.com/Calendar, Vapi) later.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

// Anthropic tool schemas.
export const AGENT_TOOLS = [
  {
    name: "get_prescore",
    description: "Recall the contact's Capital Readiness lead pre-score and weakest dimension, to use as the opening cue. Advisory only — never a funding prediction.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "schedule_demo",
    description: "Log that the contact wants to book a demo with the iCFO team. Provide the caller's preferred time in words if given.",
    input_schema: {
      type: "object",
      properties: { preferred_time: { type: "string", description: "Caller's preferred time in their words, e.g. 'Tuesday afternoon'." } },
      required: [],
    },
  },
  {
    name: "request_human_transfer",
    description: "Hand the live call to a human when the contact wants to speak with a person now.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Short reason / context to whisper to the human." } },
      required: ["reason"],
    },
  },
  {
    name: "mark_opt_out",
    description: "Immediately honor an opt-out / do-not-call request. Adds the number to the do-not-call list and revokes consent across all channels. Call this the moment the person asks to stop or not be called.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
] as const;

export interface ToolContext {
  contactId: string;
  audience: "founder" | "investor";
  phone?: string | null;
}

type ProfileShape = { extra?: Record<string, unknown>; industries?: unknown[]; fundingStages?: unknown[]; operatingStages?: unknown[]; investorTypes?: unknown[] };

async function loadContact(contactId: string): Promise<{ name: string | null; email: string | null; phone: string | null; profile: ProfileShape; raw: Record<string, unknown> } | null> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase.from("crm_contacts").select("name, email, raw").eq("source", "odoo").eq("external_id", contactId).maybeSingle();
  if (!data) return null;
  const row = data as { name: string | null; email: string | null; raw: Record<string, unknown> | null };
  const rawObj = row.raw ?? {};
  const profile = (rawObj.__profile as ProfileShape) ?? {};
  const phone = (rawObj.phone as string) || (rawObj.mobile as string) || null;
  return { name: row.name, email: row.email, phone, profile, raw: rawObj };
}

/** Driver-based lead pre-score from real CRM signals. Never a funding prediction. */
async function getPrescore(ctx: ToolContext) {
  const c = await loadContact(ctx.contactId);
  if (!c) return { scoreKind: "lead_prescore", score: 0, weakestDimension: "profile detail", note: "No profile on file." };

  const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim()));
  const extra = c.profile.extra ?? {};
  const bio = Object.entries(extra).find(([k]) => /bio|experience|summary/i.test(k))?.[1];

  const dims: { key: string; label: string; filled: boolean }[] = [
    { key: "narrative", label: "story and background", filled: has(bio) || has(c.raw.comment) },
    { key: "market", label: "market focus", filled: has(c.profile.industries) },
    { key: "stage", label: "stage clarity", filled: has(c.profile.fundingStages) || has(c.profile.operatingStages) },
    { key: "reachability", label: "contact details", filled: has(c.phone) && has(c.email) },
  ];
  const filled = dims.filter((d) => d.filled).length;
  const score = Math.round((filled / dims.length) * 100);
  const weakest = dims.find((d) => !d.filled) ?? dims[0];
  return { scoreKind: "lead_prescore" as const, score, weakestDimension: weakest.label, dimensions: dims };
}

async function logTouch(contactId: string, summary: string) {
  const supabase = raw(createServiceRoleClient());
  await supabase.from("outreach_touches").insert({ contact_id: contactId, channel: "voice", direction: "outbound", summary }).select("id").maybeSingle().then(() => undefined, () => undefined);
}

async function scheduleDemo(ctx: ToolContext, input: { preferred_time?: string }) {
  await logTouch(ctx.contactId, `Demo requested${input.preferred_time ? ` — preferred: ${input.preferred_time}` : ""}`);
  return { ok: true, message: "Noted — the iCFO team will confirm a demo time by email.", preferredTime: input.preferred_time ?? null };
}

async function requestHumanTransfer(ctx: ToolContext, input: { reason: string }) {
  await logTouch(ctx.contactId, `Human transfer requested: ${input.reason}`);
  return { ok: true, whisper: `Live ${ctx.audience} on iCapOS Voice — ${input.reason}`, message: "Connecting you with a member of the iCFO team now." };
}

/** REAL compliance action: DNC + revoke consent across all channels. */
async function markOptOut(ctx: ToolContext) {
  const supabase = raw(createServiceRoleClient());
  const c = await loadContact(ctx.contactId);
  const number = ctx.phone || c?.phone || null;
  if (number) {
    await supabase.from("dnc_list").upsert({ number, scope: "all", reason: "opt_out_on_call" }, { onConflict: "number,scope" });
  }
  await supabase.from("consent_records").update({ revoked_at: new Date().toISOString() }).eq("contact_id", ctx.contactId).is("revoked_at", null);
  await logTouch(ctx.contactId, "Opt-out — added to DNC, consent revoked all channels");
  return { ok: true, message: "You're all set — I've removed you and you won't be contacted again. Thanks for your time." };
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "get_prescore": return getPrescore(ctx);
    case "schedule_demo": return scheduleDemo(ctx, input as { preferred_time?: string });
    case "request_human_transfer": return requestHumanTransfer(ctx, input as { reason: string });
    case "mark_opt_out": return markOptOut(ctx);
    default: return { error: `Unknown tool: ${name}` };
  }
}
