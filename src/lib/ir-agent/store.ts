/**
 * Server side data access for founder IR agents. Everything goes through the
 * service role, with the organization check done here, because the ir_agent_*
 * tables are not in the generated Supabase types yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_AGENT_TYPE, templateForType, type AgentType } from "./agent-types";
import { DEFAULT_TEMPLATE, LOCKED_DISCLAIMER, SLOT_MINUTES, normalizeTemplate, type AgentTemplate } from "./defaults";
import { DEFAULT_ENDING, uniqueCompanySlug, validateEnding } from "./slug";
import type { AgentContactField, AgentPublicConfig, AgentQuestion, AgentRow, TaughtAnswer } from "./types";

export const IR_AGENT_FEATURE_KEY = "ir_agent";

const db = (): SupabaseClient => serviceRoleClientUntyped();

/* ---------- master template (ir_agent_template, single row) ---------- */

type TemplateRow = { version: number; display_name: string | null; welcome_message: string | null; questions: unknown; contact_fields: unknown };

export async function getTemplate(): Promise<AgentTemplate & { version: number }> {
  try {
    const { data } = await db().from("ir_agent_template").select("version, display_name, welcome_message, questions, contact_fields").eq("id", 1).maybeSingle();
    const row = data as TemplateRow | null;
    if (!row) return { ...DEFAULT_TEMPLATE, version: 0 };
    const welcome = (row.welcome_message ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      ...normalizeTemplate({
        displayName: row.display_name ?? undefined,
        welcome: welcome.length ? [welcome[0], welcome[1] ?? ""] : undefined,
        questions: row.questions,
        contactFields: row.contact_fields,
      }),
      version: row.version,
    };
  } catch {
    return { ...DEFAULT_TEMPLATE, version: 0 };
  }
}

export async function setTemplate(raw: unknown, updatedBy: string | null): Promise<AgentTemplate | null> {
  const clean = normalizeTemplate(raw);
  const current = await getTemplate();
  const { error } = await db()
    .from("ir_agent_template")
    .upsert(
      {
        id: 1,
        version: current.version + 1,
        display_name: clean.displayName,
        welcome_message: clean.welcome.join("\n"),
        questions: clean.questions,
        contact_fields: clean.contactFields,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  return error ? null : clean;
}

/* ---------- access ---------- */

export const FOUNDER_PLANS = ["founder_free", "founder_basic", "founder_professional", "founder_premium", "founder_managed_ir"] as const;
export type PlanAccessRow = { plan_type: string; enabled: boolean };

/** Which plans include the agent: a row in ir_agent_plan_access means included. */
export async function getPlanAccess(): Promise<PlanAccessRow[]> {
  const { data } = await db().from("ir_agent_plan_access").select("plan_key");
  const on = new Set(((data ?? []) as Array<{ plan_key: string }>).map((r) => r.plan_key));
  return FOUNDER_PLANS.map((p) => ({ plan_type: p, enabled: on.has(p) }));
}

export async function setPlanAccess(rows: PlanAccessRow[]): Promise<boolean> {
  const client = db();
  for (const r of rows) {
    const res = r.enabled
      ? await client.from("ir_agent_plan_access").upsert({ plan_key: r.plan_type, updated_at: new Date().toISOString() }, { onConflict: "plan_key" })
      : await client.from("ir_agent_plan_access").delete().eq("plan_key", r.plan_type);
    if (res.error) return false;
  }
  return true;
}

export async function setAccessOverride(orgId: string, override: "allow" | "deny" | null, updatedBy: string | null): Promise<boolean> {
  const client = db();
  const res =
    override === null
      ? await client.from("ir_agent_access_overrides").delete().eq("organization_id", orgId)
      : await client
          .from("ir_agent_access_overrides")
          .upsert({ organization_id: orgId, enabled: override === "allow", updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
  return !res.error;
}

export async function getAccessOverrides(): Promise<Map<string, "allow" | "deny">> {
  const { data } = await db().from("ir_agent_access_overrides").select("organization_id, enabled");
  return new Map(((data ?? []) as Array<{ organization_id: string; enabled: boolean }>).map((r) => [r.organization_id, r.enabled ? "allow" : "deny"]));
}

export type AccessResult = {
  allowed: boolean;
  reason: "feature_off" | "override_deny" | "plan" | "ok" | "no_org";
  plan: string | null;
  override: "allow" | "deny" | null;
};

/**
 * May this founder use the agent? The admin toggle (feature_flags founder:ir_agent)
 * wins, then the per organization override, then the plan checkboxes.
 */
export async function getFounderAgentAccess(profileId: string, orgId: string | null): Promise<AccessResult> {
  const flags = await loadFeatureFlags(createServiceRoleClient());
  if (!isFeatureEnabled(flags, "founder", IR_AGENT_FEATURE_KEY)) return { allowed: false, reason: "feature_off", plan: null, override: null };
  if (!orgId) return { allowed: false, reason: "no_org", plan: null, override: null };
  const [{ data: ov }, plan, access] = await Promise.all([
    db().from("ir_agent_access_overrides").select("enabled").eq("organization_id", orgId).maybeSingle(),
    getUserPlan(profileId),
    getPlanAccess(),
  ]);
  const override: "allow" | "deny" | null = ov ? (ov.enabled ? "allow" : "deny") : null;
  if (override === "deny") return { allowed: false, reason: "override_deny", plan, override };
  if (override === "allow") return { allowed: true, reason: "ok", plan, override };
  const planOk = plan ? access.some((a) => a.plan_type === plan && a.enabled) : false;
  return { allowed: planOk, reason: planOk ? "ok" : "plan", plan, override };
}

/* ---------- agents ---------- */

export async function getAgentByOrg(orgId: string): Promise<AgentRow | null> {
  const { data } = await db().from("ir_agents").select("*").eq("organization_id", orgId).maybeSingle();
  return (data as AgentRow | null) ?? null;
}

export async function getAgentById(id: string): Promise<AgentRow | null> {
  const { data } = await db().from("ir_agents").select("*").eq("id", id).maybeSingle();
  return (data as AgentRow | null) ?? null;
}

export async function getLiveAgentByAddress(companySlug: string, ending: string): Promise<AgentRow | null> {
  const { data } = await db().from("ir_agents").select("*").eq("company_slug", companySlug).eq("ending", ending).eq("status", "live").maybeSingle();
  return (data as AgentRow | null) ?? null;
}

/** Create the organization's agent from the master template. Idempotent per organization. */
export async function createAgentForOrg(input: { orgId: string; companyName: string; createdBy: string; agentType?: AgentType }): Promise<AgentRow | null> {
  const existing = await getAgentByOrg(input.orgId);
  if (existing) return existing;
  const client = db();
  const master = await getTemplate();
  const agentType = input.agentType ?? DEFAULT_AGENT_TYPE;
  const template = { ...templateForType(agentType, master), version: master.version };
  const { data: slugs } = await client.from("ir_agents").select("company_slug");
  const taken = new Set<string>((slugs ?? []).map((r: { company_slug: string }) => r.company_slug));
  const companySlug = uniqueCompanySlug(input.companyName, taken);
  const { data: agent, error } = await client
    .from("ir_agents")
    .insert({
      organization_id: input.orgId,
      company_slug: companySlug,
      ending: DEFAULT_ENDING,
      company_name: input.companyName.trim().slice(0, 120) || "Our company",
      display_name: template.displayName,
      welcome_message: template.welcome.join("\n"),
      template_version: template.version,
      agent_type: agentType,
      host_profile_id: input.createdBy,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error || !agent) {
    console.error("[ir-agent] create failed", error?.message);
    return null;
  }
  await client.from("ir_agent_questions").insert(
    template.questions.map((q, i) => ({ agent_id: agent.id, field: q.field, prompt: q.prompt, options: q.options, position: i, enabled: q.enabled, is_default: true })),
  );
  await client.from("ir_agent_contact_fields").insert(
    template.contactFields.map((c, i) => ({ agent_id: agent.id, key: c.key, label: c.label, kind: c.kind, required: c.required, enabled: c.enabled, position: i })),
  );
  return agent as AgentRow;
}

export async function getQuestions(agentId: string): Promise<AgentQuestion[]> {
  const { data } = await db().from("ir_agent_questions").select("id, field, prompt, options, enabled, position").eq("agent_id", agentId).order("position");
  return ((data ?? []) as Array<Omit<AgentQuestion, "options"> & { options: unknown }>).map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options.map(String) : [],
  }));
}

export async function getContactFields(agentId: string): Promise<AgentContactField[]> {
  const { data } = await db().from("ir_agent_contact_fields").select("id, key, label, kind, required, enabled, position").eq("agent_id", agentId).order("position");
  return (data ?? []) as AgentContactField[];
}

export async function getTaughtAnswers(agentId: string): Promise<TaughtAnswer[]> {
  const { data } = await db().from("ir_agent_answers").select("id, question, answer").eq("agent_id", agentId).order("created_at");
  return (data ?? []) as TaughtAnswer[];
}

export async function getSourceTexts(agentId: string): Promise<string[]> {
  const { data } = await db().from("ir_agent_sources").select("extracted_text").eq("agent_id", agentId).eq("status", "trained");
  return ((data ?? []) as Array<{ extracted_text: string | null }>).map((s) => s.extracted_text ?? "").filter(Boolean);
}

async function hostBookingReady(hostId: string | null): Promise<boolean> {
  if (!hostId) return false;
  const { data } = await db().from("scheduling_availability").select("weekly_rules").eq("profile_id", hostId).maybeSingle();
  const rules = (data as { weekly_rules?: unknown } | null)?.weekly_rules;
  return Array.isArray(rules) && rules.length > 0;
}

async function orgIsDemo(orgId: string): Promise<boolean> {
  const { data } = await db().from("organizations").select("purpose, email_dispatch_enabled").eq("id", orgId).maybeSingle();
  return Boolean(data && (data.purpose === "demo" || data.purpose === "internal" || data.email_dispatch_enabled === false));
}

/** The config the chat component renders. Nothing private in it. */
export async function buildPublicConfig(agent: AgentRow): Promise<AgentPublicConfig> {
  const [questions, contactFields, taughtAnswers, bookingReady, demo] = await Promise.all([
    getQuestions(agent.id),
    getContactFields(agent.id),
    getTaughtAnswers(agent.id),
    hostBookingReady(agent.host_profile_id),
    orgIsDemo(agent.organization_id),
  ]);
  const vars = { company: agent.company_name, name: agent.display_name };
  const welcome = (agent.welcome_message ?? DEFAULT_TEMPLATE.welcome.join("\n"))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((l) => l.replaceAll("{{company}}", vars.company).replaceAll("{{name}}", vars.name));
  return {
    id: agent.id,
    companySlug: agent.company_slug,
    ending: agent.ending,
    companyName: agent.company_name,
    displayName: agent.display_name,
    imageUrl: agent.image_url,
    welcome,
    disclaimer: LOCKED_DISCLAIMER.replaceAll("{{company}}", agent.company_name),
    hostProfileId: agent.host_profile_id,
    slotMinutes: SLOT_MINUTES,
    questions: questions.filter((q) => q.enabled),
    contactFields: contactFields.filter((c) => c.enabled),
    taughtAnswers,
    bookingReady,
    demo,
  };
}

/* ---------- founder edits ---------- */

export type AgentPatch = {
  ending?: string;
  display_name?: string;
  company_name?: string;
  welcome_message?: string;
  about?: string;
  status?: "draft" | "live" | "paused";
  host_profile_id?: string | null;
  compliance_acknowledged_at?: string | null;
  compliance_acknowledged_by?: string | null;
  wired_excluded?: string[];
};

export async function updateAgent(agentId: string, patch: AgentPatch): Promise<{ ok: true; agent: AgentRow } | { ok: false; error: string }> {
  if (patch.ending !== undefined) {
    const check = validateEnding(patch.ending);
    if (!check.ok) return { ok: false, error: check.reason };
  }
  const { data, error } = await db().from("ir_agents").update(patch).eq("id", agentId).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save." };
  return { ok: true, agent: data as AgentRow };
}

/**
 * Switch the agent to another type: loads that type's question set, agent name and
 * welcome. Contact questions, address, photo and taught answers are kept.
 */
export async function applyAgentType(agentId: string, type: AgentType): Promise<{ ok: true; agent: AgentRow } | { ok: false; error: string }> {
  const template = templateForType(type, await getTemplate());
  const questionsOk = await replaceQuestions(agentId, template.questions);
  if (!questionsOk) return { ok: false, error: "Could not load the question set." };
  const { data, error } = await db()
    .from("ir_agents")
    .update({ agent_type: type, display_name: template.displayName, welcome_message: template.welcome.join("\n") })
    .eq("id", agentId)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not switch type." };
  return { ok: true, agent: data as AgentRow };
}

export async function replaceQuestions(agentId: string, questions: Array<Pick<AgentQuestion, "field" | "prompt" | "options" | "enabled">>): Promise<boolean> {
  const client = db();
  const { error: delErr } = await client.from("ir_agent_questions").delete().eq("agent_id", agentId);
  if (delErr) return false;
  if (!questions.length) return true;
  const { error } = await client.from("ir_agent_questions").insert(
    questions.map((q, i) => ({ agent_id: agentId, field: q.field, prompt: q.prompt, options: q.options, position: i, enabled: q.enabled, is_default: q.field !== "custom" })),
  );
  return !error;
}

export async function replaceContactFields(agentId: string, fields: Array<Pick<AgentContactField, "key" | "label" | "kind" | "required" | "enabled">>): Promise<boolean> {
  const client = db();
  const { error: delErr } = await client.from("ir_agent_contact_fields").delete().eq("agent_id", agentId);
  if (delErr) return false;
  if (!fields.length) return true;
  const { error } = await client.from("ir_agent_contact_fields").insert(fields.map((c, i) => ({ agent_id: agentId, ...c, position: i })));
  return !error;
}

export async function endingTaken(companySlug: string, ending: string, exceptAgentId: string): Promise<boolean> {
  const { data } = await db().from("ir_agents").select("id").eq("company_slug", companySlug).eq("ending", ending).neq("id", exceptAgentId).maybeSingle();
  return Boolean(data);
}
