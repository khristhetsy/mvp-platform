import { sourceTagFromQuery } from "@/lib/attribution/source";
import { JESSICA_HOST_PROFILE_ID } from "@/lib/jessica/config";
import { JOHNNY_HOST_PROFILE_ID } from "@/lib/johnny/config";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { createStandaloneAgent } from "./store";

/**
 * The personal chat pages (Jessica, Johnny, Khris, Michael) are served from code.
 * Each one gets an ordinary agent record so its views and conversations land in the
 * same tables as every other agent. The record is created on first use and is not
 * set live, so no public founder page is served for it. Writes here never throw:
 * tracking must not break a chat.
 */
export const STAFF_KEYS = ["jessica", "johnny", "khris", "michael"] as const;
export type StaffKey = (typeof STAFF_KEYS)[number];

type AgentKind = NonNullable<Parameters<typeof createStandaloneAgent>[0]["agentType"]>;
type Turn = { role: "user" | "assistant"; content: string };

const STAFF: Record<StaffKey, { name: string; type: AgentKind; createdBy: string }> = {
  jessica: { name: "Jessica Santos", type: "sales", createdBy: JESSICA_HOST_PROFILE_ID },
  johnny: { name: "Johnny Rivera", type: "ir", createdBy: JOHNNY_HOST_PROFILE_ID },
  khris: { name: "Khris Thetsy", type: "marketing", createdBy: JESSICA_HOST_PROFILE_ID },
  michael: { name: "Michael", type: "sales", createdBy: JESSICA_HOST_PROFILE_ID },
};

const known = new Map<StaffKey, string>();

async function staffAgentId(key: StaffKey): Promise<string | null> {
  const cached = known.get(key);
  if (cached) return cached;
  const s = STAFF[key];
  const { data } = await serviceRoleClientUntyped()
    .from("ir_agents")
    .select("id")
    .eq("company_name", s.name)
    .eq("created_by", s.createdBy)
    .eq("agent_type", s.type)
    .is("organization_id", null)
    .limit(1)
    .maybeSingle();
  const found = (data as { id: string } | null)?.id ?? null;
  const id =
    found ?? (await createStandaloneAgent({ name: s.name, createdBy: s.createdBy, agentType: s.type }))?.id ?? null;
  if (id) known.set(key, id);
  return id;
}

/** The link tag the page was opened with, read from the page address the browser sends. */
export function sourceFromReferer(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    return sourceTagFromQuery(new URL(ref).searchParams);
  } catch {
    return null;
  }
}

export async function recordStaffView(key: StaffKey, sessionId: string, source: string | null): Promise<void> {
  try {
    const agentId = await staffAgentId(key);
    if (!agentId) return;
    const { error } = await serviceRoleClientUntyped()
      .from("ir_agent_views")
      .upsert(
        { agent_id: agentId, session_id: sessionId, source: source ? source.slice(0, 120) : null },
        { onConflict: "agent_id,session_id" },
      );
    if (error) console.error("[staff-agent] view write failed", error.message);
  } catch (e) {
    console.error("[staff-agent] view write failed", e instanceof Error ? e.message : e);
  }
}

export async function recordStaffConversation(
  key: StaffKey,
  input: { sessionId: string | undefined; source: string | null; turns: Turn[]; replyText: string },
): Promise<void> {
  try {
    if (!input.sessionId) return;
    const agentId = await staffAgentId(key);
    if (!agentId) return;
    const transcript = [...input.turns, { role: "assistant" as const, content: input.replyText }]
      .map((t) => ({ role: t.role, content: t.content.slice(0, 600) }))
      .filter((t) => t.content.length > 0)
      .slice(-80);
    const { error } = await serviceRoleClientUntyped()
      .from("ir_agent_conversations")
      .upsert(
        {
          agent_id: agentId,
          session_id: input.sessionId,
          source: input.source ? input.source.slice(0, 120) : null,
          transcript,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id,session_id" },
      );
    if (error) console.error("[staff-agent] conversation write failed", error.message);
  } catch (e) {
    console.error("[staff-agent] conversation write failed", e instanceof Error ? e.message : e);
  }
}

/** Flattens a reply into transcript text without depending on each route's reply type. */
export function replyToText(reply: unknown): string {
  const r = (reply ?? {}) as { lines?: unknown; bridge?: unknown; question?: unknown };
  const parts: unknown[] = [...(Array.isArray(r.lines) ? r.lines : []), r.bridge, r.question];
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");
}
