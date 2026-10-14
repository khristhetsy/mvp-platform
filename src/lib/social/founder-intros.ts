/**
 * Investor intros for the founder Overview and Attribution tabs.
 *
 * An intro counts toward a post only when the investor came through that founder's
 * tracked link: the investor's email is a CRM contact whose lead_source is one of the
 * founder's campaign tags (the tag a /r/ link carries). Intros from any other source
 * (Matching Center browsing, direct outreach) are counted separately as "other".
 * The tag is per campaign, so intros are attributed to a campaign, not a single post.
 *
 * Source: intro_requests the founder made (requested_by), investor_id is a profile.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type FounderIntros = {
  total: number;
  /** Intros whose investor came through one of the founder's tracked links. */
  fromLinks: number;
  /** Per campaign source tag. */
  byTag: Record<string, number>;
};

/** Pure: which tag, if any, each intro belongs to. First matching tag wins. */
export function attributeIntros(introEmails: Array<string | null>, emailsByTag: Record<string, string[]>): FounderIntros {
  const lookup = new Map<string, string>();
  for (const [tag, emails] of Object.entries(emailsByTag)) {
    for (const e of emails) {
      const k = e.trim().toLowerCase();
      if (k && !lookup.has(k)) lookup.set(k, tag);
    }
  }
  const byTag: Record<string, number> = {};
  let fromLinks = 0;
  for (const e of introEmails) {
    const tag = e ? lookup.get(e.trim().toLowerCase()) : undefined;
    if (!tag) continue;
    byTag[tag] = (byTag[tag] ?? 0) + 1;
    fromLinks += 1;
  }
  return { total: introEmails.length, fromLinks, byTag };
}

export async function founderIntroBreakdown(founderId: string, start: Date, end: Date, tags: string[]): Promise<FounderIntros> {
  const { data, error } = await db().from("intro_requests")
    .select("investor_id")
    .eq("requested_by", founderId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .limit(5000);
  if (error) return { total: 0, fromLinks: 0, byTag: {} };
  const ids = ((data ?? []) as Array<{ investor_id: string | null }>).map((r) => r.investor_id).filter((x): x is string => Boolean(x));
  if (!ids.length || !tags.length) return { total: ids.length, fromLinks: 0, byTag: {} };

  const { data: profs } = await db().from("profiles").select("id, email").in("id", [...new Set(ids)]);
  const emailById = new Map(((profs ?? []) as Array<{ id: string; email: string | null }>).map((p) => [p.id, p.email]));
  const introEmails = ids.map((id) => emailById.get(id) ?? null);
  const all = [...new Set(introEmails.filter((e): e is string => Boolean(e)).flatMap((e) => [e, e.trim().toLowerCase()]))];
  if (!all.length) return { total: ids.length, fromLinks: 0, byTag: {} };

  const emailsByTag: Record<string, string[]> = {};
  for (const tag of tags) {
    const { data: rows } = await db().from("crm_contacts").select("email").eq("overrides->>lead_source", tag).in("email", all).limit(5000);
    emailsByTag[tag] = ((rows ?? []) as Array<{ email: string | null }>).map((r) => r.email ?? "").filter(Boolean);
  }
  return attributeIntros(introEmails, emailsByTag);
}

/** All intro requests the founder made in the period, whatever the source. */
export async function countFounderIntros(founderId: string, start: Date, end: Date): Promise<number> {
  const { count, error } = await db().from("intro_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", founderId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) return 0;
  return count ?? 0;
}
