import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { WIRED_KEYS, wiredSelectedCounts } from "@/lib/ir-agent/wired";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { AgentRow } from "@/lib/ir-agent/types";

export const dynamic = "force-dynamic";

export type AgentListItem = {
  id: string;
  name: string;
  /** The account company, or the agent's own company name when none is linked. */
  companyName: string;
  organizationId: string | null;
  agentType: string;
  status: "draft" | "live" | "paused";
  archived: boolean;
  description: string;
  imageUrl: string | null;
  address: string;
  firstQuestion: string | null;
  updatedAt: string;
  features: { questions: number; contactFields: number; wired: number; wiredTotal: number; pdfs: number; booking: boolean; conversations: number };
};

/** Every AI Agent for the Agents tab: who it is for, what it does and which features are on. */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = serviceRoleClientUntyped();
  const { data, error } = await db.from("ir_agents").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Could not load agents." }, { status: 500 });
  const agents = (data ?? []) as AgentRow[];
  if (!agents.length) return NextResponse.json({ agents: [] satisfies AgentListItem[] });

  const ids = agents.map((a) => a.id);
  const orgIds = [...new Set(agents.map((a) => a.organization_id).filter((v): v is string => Boolean(v)))];
  const hostIds = [...new Set(agents.map((a) => a.host_profile_id).filter((v): v is string => Boolean(v)))];
  const [orgs, questions, fields, sources, avail, wired, convCounts] = await Promise.all([
    orgIds.length ? db.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] }),
    db.from("ir_agent_questions").select("agent_id, prompt, enabled, position").in("agent_id", ids).order("position"),
    db.from("ir_agent_contact_fields").select("agent_id, enabled").in("agent_id", ids),
    db.from("ir_agent_sources").select("agent_id, status").in("agent_id", ids).eq("status", "trained"),
    hostIds.length ? db.from("scheduling_availability").select("profile_id, weekly_rules").in("profile_id", hostIds) : Promise.resolve({ data: [] }),
    wiredSelectedCounts(agents),
    Promise.all(ids.map(async (id) => [id, (await db.from("ir_agent_conversations").select("id", { count: "exact", head: true }).eq("agent_id", id)).count ?? 0] as const)),
  ]);

  const orgName = new Map(((orgs.data ?? []) as Array<{ id: string; name: string | null }>).map((o) => [o.id, (o.name ?? "").trim()]));
  const qBy = new Map<string, Array<{ prompt: string; enabled: boolean }>>();
  for (const q of (questions.data ?? []) as Array<{ agent_id: string; prompt: string; enabled: boolean }>) qBy.set(q.agent_id, [...(qBy.get(q.agent_id) ?? []), q]);
  const cBy = new Map<string, number>();
  for (const f of (fields.data ?? []) as Array<{ agent_id: string; enabled: boolean }>) if (f.enabled) cBy.set(f.agent_id, (cBy.get(f.agent_id) ?? 0) + 1);
  const sBy = new Map<string, number>();
  for (const s of (sources.data ?? []) as Array<{ agent_id: string }>) sBy.set(s.agent_id, (sBy.get(s.agent_id) ?? 0) + 1);
  const ready = new Set(((avail.data ?? []) as Array<{ profile_id: string; weekly_rules: unknown }>).filter((r) => Array.isArray(r.weekly_rules) && r.weekly_rules.length > 0).map((r) => r.profile_id));
  const conv = new Map(convCounts);

  const list: AgentListItem[] = agents.map((a) => {
    const qs = (qBy.get(a.id) ?? []).filter((q) => q.enabled);
    const company = (a.organization_id ? orgName.get(a.organization_id) : "") || a.company_name;
    const opening = (a.welcome_message ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
    return {
      id: a.id,
      name: a.display_name,
      companyName: company,
      organizationId: a.organization_id,
      agentType: a.agent_type ?? "founder",
      status: a.status,
      archived: Boolean(a.archived_at),
      description: opening.replaceAll("{{company}}", a.company_name).replaceAll("{{name}}", a.display_name),
      imageUrl: a.image_url,
      address: `icapos.com/${a.company_slug}/${a.ending}`,
      firstQuestion: qs[0]?.prompt ?? null,
      updatedAt: a.updated_at,
      features: {
        questions: qs.length,
        contactFields: cBy.get(a.id) ?? 0,
        wired: wired.get(a.id) ?? 0,
        wiredTotal: WIRED_KEYS.length,
        pdfs: sBy.get(a.id) ?? 0,
        booking: a.host_profile_id ? ready.has(a.host_profile_id) : false,
        conversations: conv.get(a.id) ?? 0,
      },
    };
  });
  return NextResponse.json({ agents: list });
}
