/**
 * Agent traction: which AI Agents start the most visitor conversations, how that
 * moved against the previous period of the same length, and where it came from.
 *
 * The measure is a conversation (one row per visitor session in
 * ir_agent_conversations), because that is what is recorded today. Page opens
 * and button taps are not recorded, so this module never reports them.
 */
import { AGENT_TYPE_SPECS, isAgentType } from "./agent-types";

export const TRACTION_PERIODS = [7, 30, 90] as const;
export type TractionPeriod = (typeof TRACTION_PERIODS)[number];

export type TractionConversation = { agent_id: string; source: string | null; created_at: string; booked_at: string | null };
export type TractionView = { agent_id: string; source: string | null; created_at: string };
export type TractionAgent = {
  id: string;
  name: string;
  companyName: string;
  agentType: string | null;
  imageUrl: string | null;
  /** Public address parts, used to find the posts that carry the agent link. */
  companySlug?: string | null;
  ending?: string | null;
};

/** One place the agent link went out as a social post. */
export type Placement = {
  postId: string;
  network: string;
  status: "Published" | "Scheduled" | "Failed" | "Skipped" | "Draft";
  title: string;
  /** ISO time the post went out, or is due, or was created. */
  when: string | null;
  /** The real post on the network. Null until it is published. */
  url: string | null;
};

export type PostRow = { id: string; title: string | null; body: string; link_url: string | null; comment_text: string | null; status: string; scheduled_at: string | null; created_at: string };
export type VariantRow = { post_id: string; account_id: string; status: string; url: string | null; published_at: string | null; comment_text: string | null };
export type AccountRow = { id: string; platform: string };

export const SOURCE_CHANNELS = ["LinkedIn", "Email", "Event", "Social media", "Website", "Direct", "Other"] as const;
export type SourceChannel = (typeof SOURCE_CHANNELS)[number];

export type SourceShare = { channel: SourceChannel; count: number; share: number; changePct: number | null };
export type AgentTraction = {
  id: string;
  name: string;
  companyName: string;
  department: string;
  imageUrl: string | null;
  current: number;
  previous: number;
  /** Null when the previous period had none, so there is nothing to compare with. */
  changePct: number | null;
  booked: number;
  /** Visitor sessions that opened the agent page. Null when views are not recorded yet. */
  views: number | null;
  viewsPrevious: number | null;
  viewsChangePct: number | null;
  sources: SourceShare[];
  placements: Placement[];
};
export type DepartmentTraction = { department: string; agents: number; current: number; previous: number; changePct: number | null };
export type Traction = {
  days: TractionPeriod;
  total: { current: number; previous: number; changePct: number | null; booked: number };
  agents: AgentTraction[];
  departments: DepartmentTraction[];
  sources: SourceShare[];
};

/** Percent change from previous to current. Null when previous is 0: no base to measure against. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** The agent type is the department that owns the agent. */
export function departmentOf(agentType: string | null): string {
  const t = agentType && isAgentType(agentType) ? agentType : "founder";
  return AGENT_TYPE_SPECS[t].label;
}

/** Free-form source tags (utm, ?src=) grouped into a channel. No tag means a direct visit. */
export function channelOf(source: string | null): SourceChannel {
  const s = (source ?? "").trim().toLowerCase();
  if (!s || s === "direct") return "Direct";
  // The platform's own tag prefixes: li-, em-, web-, rd_ (see lib/social/attribution).
  const prefix = s.split(/[-_]/)[0];
  if (prefix === "li") return "LinkedIn";
  if (prefix === "em") return "Email";
  if (prefix === "web") return "Website";
  if (prefix === "rd") return "Social media";
  if (s.includes("linkedin")) return "LinkedIn";
  if (/(mail|newsletter|campaign|sequence)/.test(s)) return "Email";
  if (/(event|expo|webinar|conference)/.test(s)) return "Event";
  if (/(twitter|facebook|instagram|reddit|social|youtube|tiktok|(^|[^a-z])x([^a-z]|$))/.test(s)) return "Social media";
  if (/(website|site|web|home|blog)/.test(s)) return "Website";
  return "Other";
}

function shares(rows: Array<{ channel: SourceChannel }>, prevRows: Array<{ channel: SourceChannel }>): SourceShare[] {
  const cur = new Map<SourceChannel, number>();
  const prev = new Map<SourceChannel, number>();
  for (const r of rows) cur.set(r.channel, (cur.get(r.channel) ?? 0) + 1);
  for (const r of prevRows) prev.set(r.channel, (prev.get(r.channel) ?? 0) + 1);
  return SOURCE_CHANNELS.map((channel) => {
    const count = cur.get(channel) ?? 0;
    return { channel, count, share: rows.length ? Math.round((count / rows.length) * 1000) / 10 : 0, changePct: changePct(count, prev.get(channel) ?? 0) };
  })
    .filter((s) => s.count > 0 || (prev.get(s.channel) ?? 0) > 0)
    .sort((a, b) => b.count - a.count);
}

const NETWORK_LABEL: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit" };

function postTitle(p: Pick<PostRow, "title" | "body">): string {
  const t = (p.title ?? "").trim() || (p.body.split(/\r?\n/)[0] ?? "").trim();
  return t.length > 70 ? `${t.slice(0, 69).trimEnd()}…` : t || "Untitled post";
}

function variantStatus(status: string): Placement["status"] {
  if (status === "published") return "Published";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Scheduled";
}

/**
 * The social posts that carry one agent's link (in the post link or the first
 * comment), one entry per network the post went to. Newest first. A post with no
 * variants yet is a draft and shows without a network.
 */
export function placementsFor(agent: Pick<TractionAgent, "companySlug" | "ending">, posts: PostRow[], variants: VariantRow[], accounts: AccountRow[]): Placement[] {
  if (!agent.companySlug || !agent.ending) return [];
  const needle = `/${agent.companySlug}/${agent.ending}`.toLowerCase();
  const platform = new Map(accounts.map((a) => [a.id, a.platform]));
  const out: Placement[] = [];
  for (const p of posts) {
    const vs = variants.filter((v) => v.post_id === p.id);
    const carries = [p.link_url, p.comment_text, ...vs.map((v) => v.comment_text)].some((t) => (t ?? "").toLowerCase().includes(needle));
    if (!carries) continue;
    if (!vs.length) {
      out.push({ postId: p.id, network: "Not chosen yet", status: "Draft", title: postTitle(p), when: p.scheduled_at ?? p.created_at, url: null });
      continue;
    }
    for (const v of vs) {
      const net = platform.get(v.account_id) ?? "";
      out.push({ postId: p.id, network: NETWORK_LABEL[net] ?? (net || "Network"), status: variantStatus(v.status), title: postTitle(p), when: v.published_at ?? p.scheduled_at ?? p.created_at, url: v.status === "published" ? v.url : null });
    }
  }
  return out.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
}

/**
 * Conversations must cover at least the last 2 x days so the previous period can
 * be compared. Rows outside both windows are ignored. Sorted by current period
 * conversations, then by name so ties are stable.
 */
export type TractionExtras = {
  /** Null when views are not recorded yet (the table does not exist). */
  views?: TractionView[] | null;
  posts?: PostRow[];
  variants?: VariantRow[];
  accounts?: AccountRow[];
};

export function buildTraction(agents: TractionAgent[], conversations: TractionConversation[], days: TractionPeriod, now: Date = new Date(), extras: TractionExtras = {}): Traction {
  const dayMs = 86_400_000;
  const curStart = now.getTime() - days * dayMs;
  const prevStart = curStart - days * dayMs;
  const known = new Map(agents.map((a) => [a.id, a]));

  const cur: Array<TractionConversation & { channel: SourceChannel }> = [];
  const prev: Array<TractionConversation & { channel: SourceChannel }> = [];
  for (const c of conversations) {
    if (!known.has(c.agent_id)) continue;
    const t = new Date(c.created_at).getTime();
    if (Number.isNaN(t) || t > now.getTime()) continue;
    const row = { ...c, channel: channelOf(c.source) };
    if (t >= curStart) cur.push(row);
    else if (t >= prevStart) prev.push(row);
  }

  const viewsIn = (id: string, from: number, to: number) =>
    (extras.views ?? []).filter((v) => {
      const t = new Date(v.created_at).getTime();
      return v.agent_id === id && t >= from && t < to;
    }).length;

  const list: AgentTraction[] = agents.map((a) => {
    const c = cur.filter((r) => r.agent_id === a.id);
    const p = prev.filter((r) => r.agent_id === a.id);
    const recorded = Array.isArray(extras.views);
    const vCur = recorded ? viewsIn(a.id, curStart, now.getTime() + 1) : null;
    const vPrev = recorded ? viewsIn(a.id, prevStart, curStart) : null;
    return {
      id: a.id,
      name: a.name,
      companyName: a.companyName,
      department: departmentOf(a.agentType),
      imageUrl: a.imageUrl,
      current: c.length,
      previous: p.length,
      changePct: changePct(c.length, p.length),
      booked: c.filter((r) => r.booked_at).length,
      views: vCur,
      viewsPrevious: vPrev,
      viewsChangePct: vCur === null || vPrev === null ? null : changePct(vCur, vPrev),
      sources: shares(c, p),
      placements: placementsFor(a, extras.posts ?? [], extras.variants ?? [], extras.accounts ?? []),
    };
  });
  list.sort((a, b) => b.current - a.current || a.name.localeCompare(b.name));

  const deptMap = new Map<string, DepartmentTraction>();
  for (const a of list) {
    const d = deptMap.get(a.department) ?? { department: a.department, agents: 0, current: 0, previous: 0, changePct: null };
    d.agents += 1;
    d.current += a.current;
    d.previous += a.previous;
    deptMap.set(a.department, d);
  }
  const departments = [...deptMap.values()]
    .map((d) => ({ ...d, changePct: changePct(d.current, d.previous) }))
    .sort((a, b) => b.current - a.current || a.department.localeCompare(b.department));

  return {
    days,
    total: { current: cur.length, previous: prev.length, changePct: changePct(cur.length, prev.length), booked: cur.filter((r) => r.booked_at).length },
    agents: list,
    departments,
    sources: shares(cur, prev),
  };
}
