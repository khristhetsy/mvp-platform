// Prospect Pipeline — Step 4: two-sided approach models. Deterministic and
// grounded in real data (no fabricated scores or outcomes). Output shapes the
// `approach` jsonb: {hook, timing, channel, priority, text}. All copy stays in
// the engagement register (no funding-outcome language) and still passes the
// Step 5 compliance lint before it can ever queue.

import { computeFounderPrescore, DIMENSION_HOOK, type PrescoreInput, type PrescoreResult } from "@/lib/prescore/rubric";

export type Segment = "hot" | "warm" | "cold";
export type Channel = "email" | "email_then_call";

export interface Approach {
  hook: string;
  timing: string;
  channel: Channel;
  priority: 1 | 2 | 3;
  text: string;
}

function firstName(name?: string | null, email?: string | null): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  if (n) return n;
  const local = (email ?? "").split("@")[0]?.split(/[._-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "there";
}

export function segmentFor(prescore: number, raising: boolean): Segment {
  if (prescore >= 65 && raising) return "hot";
  if ((prescore >= 40 && prescore <= 64) || raising) return "warm";
  return "cold";
}
function priorityFor(seg: Segment): 1 | 2 | 3 {
  return seg === "hot" ? 1 : seg === "warm" ? 2 : 3;
}
function timingFor(seg: Segment): string {
  return seg === "hot" ? "this week" : seg === "warm" ? "this month" : "nurture";
}
function channelFor(phone?: string | null): Channel {
  return phone ? "email_then_call" : "email";
}

export interface FounderContact extends PrescoreInput {
  name?: string | null;
  email?: string | null;
}

/** Founder model: optimize for readiness gaps. Hook = weakest dimension; CTA = free CRR. */
export function founderApproach(contact: FounderContact): { approach: Approach; prescore: PrescoreResult } {
  const prescore = computeFounderPrescore(contact);
  const sig = (contact.signals && typeof contact.signals === "object" ? contact.signals : {}) as Record<string, unknown>;
  const raising = sig["raising"] === true || sig["raising"] === "true";
  const seg = segmentFor(prescore.score, raising);
  const first = firstName(contact.name, contact.email);
  const gap = DIMENSION_HOOK[prescore.weakest];
  const co = contact.company ? ` at ${contact.company}` : "";

  const hook = `Readiness gap: ${gap}`;
  const text = `Hi ${first} — founders${co} at your stage often get the most leverage from ${gap}. ` +
    `Want a free Capital Readiness Rating to see where you stand? It's about 10 minutes, no cost.`;

  return {
    approach: { hook, timing: timingFor(seg), channel: channelFor(contact.phone), priority: priorityFor(seg), text },
    prescore,
  };
}

export interface InvestorContact {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  signals?: Record<string, unknown> | null;
}

export interface HotFounderContext {
  count: number;
  sectors: string[];   // distinct sectors among current hot founders (may be empty)
}

/** Investor model: optimize for thesis fit. Hook = curated on-thesis access + Investor Fit Score. */
export function investorApproach(contact: InvestorContact, hot: HotFounderContext): { approach: Approach; segment: Segment } {
  const first = firstName(contact.name, contact.email);
  const sig = (contact.signals && typeof contact.signals === "object" ? contact.signals : {}) as Record<string, unknown>;
  // Investors with a stated active thesis are warmer; otherwise cold-nurture.
  const activeThesis = sig["thesis"] === true || sig["thesis"] === "true" || Boolean(sig["sectors"]);
  const seg: Segment = hot.count > 0 && activeThesis ? "warm" : "cold";

  const sectorPhrase = hot.sectors.length > 0 ? `${hot.sectors.slice(0, 3).join(", ")} ` : "";
  const cohort = hot.count > 0
    ? `${hot.count} ${sectorPhrase}founders just entered our Private Market`
    : `on-thesis founders in your focus areas are entering our Private Market`;

  const hook = "Curated on-thesis access + Investor Fit Score";
  const text = `Hi ${first} — ${cohort}. Want a curated, on-thesis look? ` +
    `Happy to share your Investor Fit Score so you can gauge alignment before any intro.`;

  return {
    approach: { hook, timing: timingFor(seg), channel: channelFor(contact.phone), priority: priorityFor(seg), text },
    segment: seg,
  };
}
