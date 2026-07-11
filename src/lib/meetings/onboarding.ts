// Weekly Meeting System — client onboarding checklist (spec §2.4).
// Each company has a fixed collateral checklist; when all items are done the company is
// marked conference_ready (feeds the booth list). Recompute happens on item toggle.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export const ONBOARDING_ITEMS: Array<{ key: string; label: string }> = [
  { key: "headshot", label: "Headshot" },
  { key: "logo", label: "Logo" },
  { key: "bio", label: "Bio" },
  { key: "summary", label: "Executive summary" },
  { key: "pitch_video", label: "Pitch video" },
  { key: "booklet", label: "Booklet" },
  { key: "reg_form", label: "Registration form" },
  { key: "booth", label: "Booth" },
  { key: "vimeo", label: "Vimeo" },
  { key: "newsletter", label: "Newsletter feature" },
  { key: "banner", label: "Banner" },
];
const ITEM_KEYS = ONBOARDING_ITEMS.map((i) => i.key);
export const ITEM_LABEL: Record<string, string> = Object.fromEntries(ONBOARDING_ITEMS.map((i) => [i.key, i.label]));

export interface OnboardingItem { item_key: string; done: boolean }
export interface OnboardingRecord {
  id: string; company_name: string; added_on: string; conference_ready: boolean;
  items: OnboardingItem[]; done: number; total: number;
}

export async function listOnboarding(): Promise<OnboardingRecord[]> {
  const { data: recs } = await db().from("ceo_client_onboarding")
    .select("id, company_name, added_on, conference_ready").order("company_name");
  const rows = (recs ?? []) as Array<{ id: string; company_name: string; added_on: string; conference_ready: boolean }>;
  if (rows.length === 0) return [];
  const { data: items } = await db().from("ceo_client_onboarding_items")
    .select("onboarding_id, item_key, done").in("onboarding_id", rows.map((r) => r.id));
  const byRec = new Map<string, OnboardingItem[]>();
  for (const it of (items ?? []) as Array<{ onboarding_id: string; item_key: string; done: boolean }>) {
    const arr = byRec.get(it.onboarding_id) ?? [];
    arr.push({ item_key: it.item_key, done: it.done });
    byRec.set(it.onboarding_id, arr);
  }
  return rows.map((r) => {
    const its = byRec.get(r.id) ?? [];
    return { id: r.id, company_name: r.company_name, added_on: r.added_on, conference_ready: r.conference_ready, items: its, done: its.filter((i) => i.done).length, total: its.length || ITEM_KEYS.length };
  });
}

export async function createOnboarding(companyName: string, companyId?: string | null, createdBy?: string): Promise<string> {
  const { data, error } = await db().from("ceo_client_onboarding")
    .insert({ company_name: companyName, company_id: companyId ?? null, created_by: createdBy ?? null }).select("id").single();
  if (error) throw new Error(error.message);
  const id = String(data.id);
  await db().from("ceo_client_onboarding_items").insert(ITEM_KEYS.map((k) => ({ onboarding_id: id, item_key: k, done: false })));
  return id;
}

/** Toggle an item; recompute conference_ready (true iff all known items done). */
export async function toggleOnboardingItem(onboardingId: string, itemKey: string, done: boolean): Promise<{ conference_ready: boolean }> {
  if (!ITEM_KEYS.includes(itemKey)) throw new Error("Unknown item.");
  await db().from("ceo_client_onboarding_items")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("onboarding_id", onboardingId).eq("item_key", itemKey);

  const { data: items } = await db().from("ceo_client_onboarding_items").select("done").eq("onboarding_id", onboardingId);
  const list = (items ?? []) as Array<{ done: boolean }>;
  const ready = list.length >= ITEM_KEYS.length && list.every((i) => i.done);
  await db().from("ceo_client_onboarding").update({ conference_ready: ready }).eq("id", onboardingId);
  return { conference_ready: ready };
}
