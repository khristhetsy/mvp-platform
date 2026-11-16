/**
 * Group share queue (manual channel) — staff-only.
 *   GET                       → { groups, staff, run }   saved groups, staff list, latest run with items
 *   GET ?results=1&days=30    → { rows }                 per group clicks, signups, meetings (Attribution)
 *   POST { action: "group_add" | "group_update" | "group_remove" }  manage saved groups
 *   POST { action: "start", network, body, groupIds, waitMinutes, dailyCap, vary, assigneeId } → { run }
 *   POST { action: "open" | "posted" | "removed" | "skip" | "reassign", itemId }
 *
 * Neither Facebook nor LinkedIn allows posting to groups for you, so nothing is posted
 * here. Each item is a tracked draft post: its /r/<post> link logs the click and forwards
 * to /fit?s=<group tag>, so clicks, signups and meetings attribute per group on the
 * existing rails (same as Reddit). The server enforces pacing, not just the screen.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isFeatureEnabled, loadFeatureFlags } from "@/lib/feature-controls";
import { createCampaign } from "@/lib/social/campaigns";
import { originFromRequest } from "@/lib/social/request-origin";
import { REDDIT_FIT_URL } from "@/lib/social/reddit";
import {
  NETWORK_DEFAULTS, buildShareText, isGroupUrl, normalizeGroupUrl, pacing, reviewTag,
  type GroupNetwork, type ShareItem, type SocialGroup,
} from "@/lib/social/group-share";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** The Group share switch in Feature controls (admin audience). On unless an admin turned it off. */
async function switchedOn(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isFeatureEnabled(await loadFeatureFlags(createServiceRoleClient() as any), "admin", "group_share");
}

type GroupRow = Omit<SocialGroup, "owner_name"> & { owner?: { full_name?: string | null; email?: string | null } | null };
const ownerName = (o?: { full_name?: string | null; email?: string | null } | null) => o?.full_name || o?.email || null;

async function listGroups(): Promise<SocialGroup[]> {
  const { data } = await db().from("social_groups")
    .select("id, network, name, url, members, owner_id, rule_note, skip_days, needs_approval, active, campaign_id, owner:profiles!social_groups_owner_id_fkey(full_name, email)")
    .order("name", { ascending: true });
  return ((data ?? []) as GroupRow[]).map((g) => ({ ...g, skip_days: (g.skip_days ?? []).map(Number), owner_name: ownerName(g.owner) }));
}

async function listStaff(): Promise<{ id: string; name: string }[]> {
  const { data } = await db().from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]).order("full_name", { ascending: true });
  return ((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => ({ id: p.id, name: p.full_name || p.email || "Staff" }));
}

type RunRow = { id: string; network: GroupNetwork; body: string; vary_opening: boolean; wait_minutes: number; daily_cap: number; created_at: string };

async function latestRun(network: GroupNetwork) {
  const { data: run } = await db().from("social_group_shares")
    .select("id, network, body, vary_opening, wait_minutes, daily_cap, created_at")
    .eq("network", network).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return null;
  const { data } = await db().from("social_group_share_items")
    .select("id, group_id, assignee_id, position, text, post_id, status, opened_at, posted_at, removed_at, group:social_groups(name, url, members, rule_note, skip_days), assignee:profiles!social_group_share_items_assignee_id_fkey(full_name, email)")
    .eq("share_id", (run as RunRow).id).order("position", { ascending: true });
  type ItemRow = Omit<ShareItem, "group_name" | "group_url" | "members" | "rule_note" | "skip_days" | "assignee_name"> & {
    group: { name: string; url: string; members: number | null; rule_note: string | null; skip_days: number[] | null } | null;
    assignee: { full_name?: string | null; email?: string | null } | null;
  };
  const items: ShareItem[] = ((data ?? []) as ItemRow[]).map((i) => ({
    id: i.id, group_id: i.group_id, assignee_id: i.assignee_id, position: i.position, text: i.text, post_id: i.post_id,
    status: i.status, opened_at: i.opened_at, posted_at: i.posted_at, removed_at: i.removed_at,
    group_name: i.group?.name ?? "Group", group_url: i.group?.url ?? "", members: i.group?.members ?? null,
    rule_note: i.group?.rule_note ?? null, skip_days: (i.group?.skip_days ?? []).map(Number), assignee_name: ownerName(i.assignee),
  }));
  return { ...(run as RunRow), items };
}

/** Per group clicks, signups and meetings over the last N days, on the existing tag rails. */
async function results(days: number) {
  const groups = await listGroups();
  const since = new Date(Date.now() - days * 86_400_000);
  const tagged = groups.filter((g) => g.campaign_id);
  if (!tagged.length) return groups.map((g) => ({ id: g.id, network: g.network, name: g.name, posts: 0, clicks: 0, signups: 0, meetings: 0, removed: 0, review: null as ReturnType<typeof reviewTag> }));

  const { data: campaigns } = await db().from("social_campaigns").select("id, source_tag").in("id", tagged.map((g) => g.campaign_id));
  const tagOf = new Map<string, string>(((campaigns ?? []) as { id: string; source_tag: string }[]).map((c) => [c.id, c.source_tag]));

  const { data: items } = await db().from("social_group_share_items")
    .select("group_id, post_id, status, posted_at, removed_at").in("group_id", groups.map((g) => g.id));
  const rows = (items ?? []) as { group_id: string; post_id: string | null; status: string; posted_at: string | null; removed_at: string | null }[];

  const clickByGroup = new Map<string, number>();
  const postIds = rows.map((r) => r.post_id).filter((x): x is string => Boolean(x));
  const postToGroup = new Map<string, string>();
  for (const r of rows) if (r.post_id) postToGroup.set(r.post_id, r.group_id);
  if (postIds.length) {
    const { data: clicks } = await db().from("social_clicks").select("post_id").in("post_id", postIds).gte("created_at", since.toISOString());
    for (const c of (clicks ?? []) as { post_id: string }[]) {
      const g = postToGroup.get(c.post_id); if (g) clickByGroup.set(g, (clickByGroup.get(g) ?? 0) + 1);
    }
  }

  const out = [];
  for (const g of groups) {
    const tag = g.campaign_id ? tagOf.get(g.campaign_id) : undefined;
    let signups = 0, meetings = 0;
    if (tag) {
      const { count: s } = await db().from("crm_contacts").select("email", { count: "exact", head: true }).eq("overrides->>lead_source", tag);
      signups = s ?? 0;
      const { count: m } = await db().from("scheduling_bookings").select("source_tag", { count: "exact", head: true }).eq("source_tag", tag).gte("created_at", since.toISOString());
      meetings = m ?? 0;
    }
    const mine = rows.filter((r) => r.group_id === g.id && r.status === "posted");
    const first = mine.map((r) => r.posted_at).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
    const clicks = clickByGroup.get(g.id) ?? 0;
    out.push({
      id: g.id, network: g.network, name: g.name, posts: mine.length, clicks, signups, meetings,
      removed: mine.filter((r) => r.removed_at).length,
      review: reviewTag({ posts: mine.length, firstPostAt: first, clicks, signups, meetings }, new Date()),
    });
  }
  return out;
}

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  if (!(await switchedOn())) return NextResponse.json({ disabled: true });
  const url = new URL(req.url);
  if (url.searchParams.get("results")) {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
    return NextResponse.json({ rows: await results(days) });
  }
  const network: GroupNetwork = url.searchParams.get("network") === "linkedin" ? "linkedin" : "facebook";
  const [groups, staff, run] = await Promise.all([listGroups(), listStaff(), latestRun(network)]);
  return NextResponse.json({ groups, staff, run, me: profile.id });
}

const network = z.enum(["facebook", "linkedin"]);
const groupFields = {
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().max(500),
  members: z.number().int().min(0).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  ruleNote: z.string().trim().max(200).nullable().optional(),
  skipDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  needsApproval: z.boolean().optional(),
  active: z.boolean().optional(),
};
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("group_add"), network, ...groupFields }),
  z.object({ action: z.literal("group_update"), groupId: z.string().uuid(), ...groupFields, network: network.optional(), name: groupFields.name.optional(), url: groupFields.url.optional() }),
  z.object({ action: z.literal("group_remove"), groupId: z.string().uuid() }),
  z.object({
    action: z.literal("start"), network, body: z.string().trim().min(1).max(5000), groupIds: z.array(z.string().uuid()).min(1).max(100),
    waitMinutes: z.number().int().min(1).max(120).optional(), dailyCap: z.number().int().min(1).max(100).optional(),
    vary: z.boolean().optional(), assigneeId: z.string().uuid().nullable().optional(),
  }),
  z.object({ action: z.enum(["open", "posted", "removed", "skip"]), itemId: z.string().uuid() }),
  z.object({ action: z.literal("reassign"), itemId: z.string().uuid(), assigneeId: z.string().uuid().nullable() }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  if (!(await switchedOn())) return NextResponse.json({ error: "Group share is turned off in Feature controls." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = parsed.data;

  if (input.action === "group_add") {
    if (!isGroupUrl(input.network, input.url)) return NextResponse.json({ error: `Paste a ${input.network === "linkedin" ? "LinkedIn" : "Facebook"} group link (…/groups/…).` }, { status: 400 });
    const { data, error } = await db().from("social_groups").insert({
      network: input.network, name: input.name, url: normalizeGroupUrl(input.url, input.network), members: input.members ?? null,
      owner_id: input.ownerId ?? profile.id, rule_note: input.ruleNote || null, skip_days: input.skipDays ?? [],
      needs_approval: input.needsApproval ?? false, created_by: profile.id,
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "That group is already saved." : error?.message ?? "Could not save the group." }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (input.action === "group_update") {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.url !== undefined) {
      const { data: cur } = await db().from("social_groups").select("network").eq("id", input.groupId).maybeSingle();
      const net: GroupNetwork = input.network ?? (cur as { network?: GroupNetwork } | null)?.network ?? "facebook";
      if (!isGroupUrl(net, input.url)) return NextResponse.json({ error: "That is not a group link for this network." }, { status: 400 });
      patch.url = normalizeGroupUrl(input.url, net);
    }
    if (input.members !== undefined) patch.members = input.members;
    if (input.ownerId !== undefined) patch.owner_id = input.ownerId;
    if (input.ruleNote !== undefined) patch.rule_note = input.ruleNote || null;
    if (input.skipDays !== undefined) patch.skip_days = input.skipDays;
    if (input.needsApproval !== undefined) patch.needs_approval = input.needsApproval;
    if (input.active !== undefined) patch.active = input.active;
    const { error } = await db().from("social_groups").update(patch).eq("id", input.groupId);
    return NextResponse.json({ ok: !error, error: error?.message }, { status: error ? 400 : 200 });
  }

  if (input.action === "group_remove") {
    const { error } = await db().from("social_groups").delete().eq("id", input.groupId);
    return NextResponse.json({ ok: !error, error: error?.message }, { status: error ? 400 : 200 });
  }

  if (input.action === "start") {
    const { data: groupsData } = await db().from("social_groups").select("id, network, name, owner_id, campaign_id, active").in("id", input.groupIds).eq("network", input.network);
    const groups = ((groupsData ?? []) as { id: string; network: GroupNetwork; name: string; owner_id: string | null; campaign_id: string | null; active: boolean }[]).filter((g) => g.active);
    if (!groups.length) return NextResponse.json({ error: "Pick at least one active group." }, { status: 400 });
    const defaults = NETWORK_DEFAULTS[input.network];
    const { data: run, error: runErr } = await db().from("social_group_shares").insert({
      network: input.network, body: input.body, vary_opening: input.vary ?? true,
      wait_minutes: input.waitMinutes ?? defaults.wait, daily_cap: input.dailyCap ?? defaults.cap, created_by: profile.id,
    }).select("id").single();
    if (runErr || !run) return NextResponse.json({ error: runErr?.message ?? "Could not start the queue." }, { status: 400 });

    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || originFromRequest(req);
    let position = 0;
    for (const g of groups) {
      // One attribution campaign per group, created once, so results never mix across groups.
      let campaignId = g.campaign_id;
      if (!campaignId) {
        const c = await createCampaign(`${NETWORK_DEFAULTS[g.network].label}: ${g.name}`, 0, profile.id, defaults.tagPrefix);
        if (!c) continue;
        campaignId = c.id;
        await db().from("social_groups").update({ campaign_id: c.id }).eq("id", g.id);
      }
      const { data: post } = await db().from("social_posts").insert({
        body: input.body, brief: `Group share: ${g.name}`, link_url: REDDIT_FIT_URL, campaign_id: campaignId,
        department: "Marketing", status: "draft", created_by: profile.id,
      }).select("id").single();
      if (!post) continue;
      await db().from("social_group_share_items").insert({
        share_id: run.id, group_id: g.id, assignee_id: input.assigneeId === undefined ? (g.owner_id ?? profile.id) : input.assigneeId,
        position: position, text: buildShareText(input.body, `${base}/r/${post.id}`, position, input.vary ?? true), post_id: post.id,
      });
      position += 1;
    }
    if (position === 0) return NextResponse.json({ error: "Could not prepare any group." }, { status: 400 });
    return NextResponse.json({ run: await latestRun(input.network) });
  }

  // Item actions. Load the item and its run once.
  const { data: item } = await db().from("social_group_share_items")
    .select("id, share_id, group_id, post_id, status, group:social_groups(skip_days), share:social_group_shares(wait_minutes, daily_cap)")
    .eq("id", input.itemId).maybeSingle();
  const it = item as { id: string; share_id: string; group_id: string; post_id: string | null; status: string; group: { skip_days: number[] | null } | null; share: { wait_minutes: number; daily_cap: number } | null } | null;
  if (!it) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  const now = new Date();

  if (input.action === "open") {
    if (it.status === "posted" || it.status === "skipped") return NextResponse.json({ error: "This group is already done." }, { status: 409 });
    // Pacing is checked here, not only on screen, so the cap holds for the whole team.
    // The item itself is left out, so "Copy again" on an opened group is not blocked by its own wait.
    const { data: all } = await db().from("social_group_share_items").select("status, opened_at").not("opened_at", "is", null).neq("id", it.id);
    const state = pacing(((all ?? []) as { status: "waiting" | "opened" | "posted" | "skipped"; opened_at: string | null }[]).map((a) => ({ ...a, skip_days: [] })), (it.group?.skip_days ?? []).map(Number), it.share?.wait_minutes ?? 5, it.share?.daily_cap ?? 10, now);
    if (!state.allowed) {
      const reason = state.reason === "wait" ? `Wait ${Math.ceil(state.waitSeconds / 60)} more minute(s) before the next group.` : state.reason === "cap" ? "Daily limit reached. Continue tomorrow." : "This group skips today.";
      return NextResponse.json({ error: reason, pacing: state }, { status: 429 });
    }
    const { error } = await db().from("social_group_share_items").update({ status: "opened", opened_at: now.toISOString() }).eq("id", it.id).in("status", ["waiting", "opened"]);
    return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
  }

  if (input.action === "posted") {
    if (it.status === "posted" || it.status === "skipped") return NextResponse.json({ error: "This group is already done." }, { status: 409 });
    const { error } = await db().from("social_group_share_items").update({ status: "posted", posted_at: now.toISOString() }).eq("id", it.id);
    if (!error && it.post_id) await db().from("social_posts").update({ status: "published", updated_at: now.toISOString() }).eq("id", it.post_id);
    return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
  }

  if (input.action === "removed") {
    const { error } = await db().from("social_group_share_items").update({ removed_at: now.toISOString() }).eq("id", it.id);
    return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
  }

  if (input.action === "skip") {
    const { error } = await db().from("social_group_share_items").update({ status: "skipped" }).eq("id", it.id);
    // A skipped item never goes out, so its tracked draft leaves the Library.
    if (!error && it.post_id) await db().from("social_posts").update({ deleted_at: now.toISOString() }).eq("id", it.post_id).eq("status", "draft");
    return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
  }

  // reassign
  if (input.action !== "reassign") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await db().from("social_group_share_items").update({ assignee_id: input.assigneeId }).eq("id", it.id);
  return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
}
