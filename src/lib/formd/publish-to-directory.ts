import "server-only";

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { FORM_D_TYPES } from "@/lib/sales/backfill-investor-type";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { resolveSlug } from "@/lib/vocabulary/lists";

/** investor_directory.source for rows published from the SEC Form D registry. */
export const FORM_D_DIRECTORY_SOURCE = "SEC Form D";

type FirmRow = {
  id: string;
  display_name: string;
  city: string | null;
  state_or_country: string | null;
  phone: string | null;
  domain: string | null;
  needs_review: boolean;
};

export type PublishResult = {
  /** Firms newly added to the founder directory. */
  published: number;
  /** Firms already in the directory from an earlier publish. */
  alreadyPublished: number;
  /** Held back: OFAC hit or review. */
  blocked: number;
  /** Held back: the Desk still has them flagged as needing review. */
  review: number;
};

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const marker = (firmId: string) => `formd-firm:${firmId}`;

const toWebsite = (domain: string | null) => {
  const d = domain?.trim();
  if (!d) return null;
  return /^https?:\/\//i.test(d) ? d : `https://${d}`;
};

const COLUMNS = "id, display_name, city, state_or_country, phone, domain, needs_review";

/**
 * Copies SEC Form D firms into the founder Investor directory (published, source
 * "SEC Form D") so founders reach them through the existing import path: plan
 * contact space, daily cap and terms all apply unchanged. Form D lists firms, not
 * people, so these rows carry no email or contact name. Safe to run again: a firm
 * already published is skipped (keyed on notes = "formd-firm:<id>").
 */
export async function publishFormDFirms(input: { firmIds?: string[]; q?: string }): Promise<PublishResult> {
  const d = serviceRoleClientUntyped();

  let firms: FirmRow[] = [];
  if (input.firmIds?.length) {
    for (const ids of chunk([...new Set(input.firmIds)], 200)) {
      const { data, error } = await d.from("formd_firms").select(COLUMNS).in("id", ids);
      if (error) throw new Error(error.message);
      firms.push(...((data ?? []) as FirmRow[]));
    }
  } else {
    for (let from = 0; ; from += 1000) {
      let req = d.from("formd_firms").select(COLUMNS);
      if (input.q?.trim()) req = req.ilike("display_name", `%${input.q.trim()}%`);
      const { data, error } = await req.order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as FirmRow[];
      firms.push(...page);
      if (page.length < 1000) break;
    }
  }

  const result: PublishResult = { published: 0, alreadyPublished: 0, blocked: 0, review: 0 };

  const held = firms.filter((f) => f.needs_review);
  result.review = held.length;
  firms = firms.filter((f) => !f.needs_review);

  // Latest OFAC result per firm; a hit or a pending review keeps the firm out.
  const blocked = new Set<string>();
  for (const ids of chunk(firms.map((f) => f.id), 200)) {
    const { data } = await d
      .from("formd_screening")
      .select("subject_id, result, checked_at")
      .eq("subject_type", "firm")
      .eq("check_type", "ofac_sdn")
      .in("subject_id", ids)
      .order("checked_at", { ascending: false });
    const seen = new Set<string>();
    for (const s of (data ?? []) as { subject_id: string; result: string }[]) {
      if (seen.has(s.subject_id)) continue;
      seen.add(s.subject_id);
      if (s.result === "hit" || s.result === "review") blocked.add(s.subject_id);
    }
  }
  result.blocked = blocked.size;
  firms = firms.filter((f) => !blocked.has(f.id));

  const existing = new Set<string>();
  for (const ids of chunk(firms.map((f) => marker(f.id)), 200)) {
    const { data } = await d.from("investor_directory").select("notes").in("notes", ids);
    for (const r of (data ?? []) as { notes: string | null }[]) if (r.notes) existing.add(r.notes);
  }
  const fresh = firms.filter((f) => !existing.has(marker(f.id)));
  result.alreadyPublished = firms.length - fresh.length;
  if (fresh.length === 0) return result;

  // Directory investor types are option slugs; Form D investors are tagged by label.
  const vocab = await loadVocabularies();
  const investorTypes = FORM_D_TYPES.map((label) => resolveSlug(vocab.investor_type, label)).filter((s): s is string => Boolean(s));

  const rows = fresh.map((f) => ({
    firm: f.display_name,
    phone: f.phone,
    website: toWebsite(f.domain),
    city: f.city,
    state: f.state_or_country,
    investor_types: investorTypes,
    source: FORM_D_DIRECTORY_SOURCE,
    source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=D&company=${encodeURIComponent(f.display_name)}`,
    status: "published",
    verification: "needs_input",
    notes: marker(f.id),
  }));
  for (const part of chunk(rows, 500)) {
    const { error } = await d.from("investor_directory").insert(part);
    if (error) throw new Error(error.message);
  }
  result.published = rows.length;
  return result;
}
