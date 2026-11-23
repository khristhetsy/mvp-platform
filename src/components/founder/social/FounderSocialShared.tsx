"use client";

// Shared pieces for the founder Social media page and its Launch my social media wizards.
// Moved out of FounderSocialClient so the wizards can use them without importing each other.

import type { CampaignFunnel, StageKey } from "@/components/admin/social/funnel-types";


export type Account = { id: string; platform: string; displayName: string | null; status: string };
export type Campaign = { id: string; name: string; source_tag: string };
export type Post = {
  id: string; title: string | null; body: string; status: string; scheduled_at: string | null; held_until: string | null; archived_at: string | null; created_at: string;
  campaign: { name: string } | null;
  variants: { status: string; url?: string | null; published_at?: string | null; account: { platform: string; label?: string | null; display_name?: string | null } | null }[];
};

export const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit" };
export const GUIDE_KEY = "icapos_founder_social_guide_seen";
export const DRAFT_KEY = "icapos_founder_social_compose_draft";

export const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const btnPrimary = "rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2E78F5] disabled:opacity-50";
export const card = "rounded-xl border border-slate-200 bg-white p-4";
export const AGENT_COMMENT = "Chat with our IR agent:";

/** "Oct 22, 12:00 AM PT" style label for any stored instant. */
export function pt(iso: string | null, withTime = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })} PT`;
}

/** A datetime-local value typed as Pacific time, to a UTC ISO string. */
export function ptLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  for (const off of [7, 8]) {
    const cand = new Date(Date.UTC(y, mo - 1, d, h + off, mi));
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(cand);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (g("year") === y && g("month") === mo && g("day") === d && g("hour") === h && g("minute") === mi) return cand.toISOString();
  }
  return null;
}

export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string; code?: string } }> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error." } as T & { error?: string } };
  }
}

export function sumStage(funnels: CampaignFunnel[], key: StageKey): { actual: number; target: number | null } {
  let actual = 0; let target: number | null = null;
  for (const f of funnels) {
    const s = f.stages.find((x) => x.stage === key);
    if (!s) continue;
    actual += s.actual;
    if (s.target != null) target = (target ?? 0) + s.target;
  }
  return { actual, target };
}
