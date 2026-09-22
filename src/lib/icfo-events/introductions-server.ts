/**
 * Introductions — reading, sending and answering.
 *
 * Keyed on registrations rather than profiles: most attendees at a large event
 * registered as guests with no account, and an introduction they cannot be
 * part of is worthless.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";
import {
  introVars, renderTemplate, shouldFollowUp,
  type Introduction, type IntroductionStatus,
} from "@/lib/icfo-events/introductions";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

const ACTION_RESPOND = "intro";

/** A signed link, so an investor with no account can answer from the email. */
export function introToken(id: string): string {
  return makeToken({ kind: "event_invite", id, action: ACTION_RESPOND });
}

export function introFromToken(token: string): string | null {
  return verifyToken({ token, kind: "event_invite", action: ACTION_RESPOND });
}

export type TemplateKind = "invitation" | "follow_up";
export type IntroTemplate = { kind: TemplateKind; subject: string; body: string; updatedAt: string };

export async function listTemplates(): Promise<IntroTemplate[]> {
  const { data } = await raw().from("event_intro_templates").select("*").order("kind");
  return ((data ?? []) as Row[]).map((r) => ({
    kind: String(r.kind) as TemplateKind,
    subject: String(r.subject),
    body: String(r.body),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveTemplate(
  kind: TemplateKind,
  input: { subject: string; body: string },
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.subject.trim()) return { ok: false, error: "The subject can't be empty." };
  if (!input.body.trim()) return { ok: false, error: "The message can't be empty." };
  const { error } = await raw()
    .from("event_intro_templates")
    .update({
      subject: input.subject.trim(),
      body: input.body,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("kind", kind);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type IntroRow = Introduction & {
  eventId: string;
  investorRegId: string;
  founderRegId: string;
  score: number;
  sharedSectors: string[];
  roomUrl: string | null;
};

function mapIntro(r: Row): IntroRow {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    investorRegId: String(r.investor_reg_id),
    founderRegId: String(r.founder_reg_id),
    score: Number(r.score ?? 0),
    sharedSectors: Array.isArray(r.shared_sectors) ? (r.shared_sectors as string[]) : [],
    status: String(r.status) as IntroductionStatus,
    sentAt: String(r.sent_at),
    followUps: Number(r.follow_ups ?? 0),
    lastFollowUpAt: (r.last_follow_up_at as string | null) ?? null,
    roomUrl: (r.room_url as string | null) ?? null,
  };
}

/** Every introduction for an event, keyed by pair so the board can join them. */
export async function listIntroductions(eventId: string): Promise<IntroRow[]> {
  const { data, error } = await raw().from("event_introductions").select("*").eq("event_id", eventId);
  if (error) {
    console.error("[introductions] list failed:", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(mapIntro);
}

export type SendResult = { created: number; skipped: string[] };

/**
 * Record introductions for the given pairs.
 *
 * The score and shared sectors are frozen here so the email and the board can
 * never disagree about why two people were put together. A pair that already
 * has an introduction is skipped rather than duplicated — the unique index
 * enforces it, this reports it.
 */
export async function createIntroductions(
  eventId: string,
  pairs: { investorRegId: string; founderRegId: string; score: number; sharedSectors: string[] }[],
  createdBy: string | null,
): Promise<SendResult> {
  if (!pairs.length) return { created: 0, skipped: [] };

  const existing = await listIntroductions(eventId);
  const taken = new Set(existing.map((i) => [i.investorRegId, i.founderRegId].sort().join("|")));

  const fresh = pairs.filter((p) => !taken.has([p.investorRegId, p.founderRegId].sort().join("|")));
  const skipped = pairs.length - fresh.length;
  if (!fresh.length) return { created: 0, skipped: [`${skipped} already introduced`] };

  const { error } = await raw().from("event_introductions").insert(
    fresh.map((p) => ({
      event_id: eventId,
      investor_reg_id: p.investorRegId,
      founder_reg_id: p.founderRegId,
      score: p.score,
      shared_sectors: p.sharedSectors,
      created_by: createdBy,
    })),
  );
  if (error) return { created: 0, skipped: [error.message] };
  return { created: fresh.length, skipped: skipped ? [`${skipped} already introduced`] : [] };
}

/** Accept or decline. Idempotent: answering twice keeps the first answer. */
export async function respondToIntroduction(
  id: string,
  accept: boolean,
): Promise<{ ok: true; alreadyAnswered: boolean } | { ok: false; error: string }> {
  const { data } = await raw().from("event_introductions").select("*").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That introduction no longer exists." };

  const current = mapIntro(data as Row);
  if (current.status !== "sent") return { ok: true, alreadyAnswered: true };

  const { error } = await raw()
    .from("event_introductions")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, alreadyAnswered: false };
}

/** Store the room minted on acceptance. */
export async function attachRoom(id: string, url: string, expiresAt: string): Promise<void> {
  await raw()
    .from("event_introductions")
    .update({ room_url: url, room_expires_at: expiresAt })
    .eq("id", id);
}

export type FollowUpPass = {
  considered: number;
  sent: number;
  /** Why each one was skipped — a silent pass is indistinguishable from a broken one. */
  skipped: Record<string, number>;
};

/**
 * One day's founder follow-ups.
 *
 * Decides with the pure rules, then records the send. Returns a breakdown
 * rather than a bare count, because this runs unattended and "0 sent" needs to
 * be explainable.
 */
export async function runFollowUpPass(
  send: (intro: IntroRow) => Promise<boolean>,
  now: Date = new Date(),
): Promise<FollowUpPass> {
  const out: FollowUpPass = { considered: 0, sent: 0, skipped: {} };

  const { data: events } = await raw()
    .from("events")
    .select("id, starts_at")
    .in("status", ["published", "live"]);

  for (const e of ((events ?? []) as Row[])) {
    const eventId = String(e.id);
    const startsAt = (e.starts_at as string | null) ?? null;

    for (const intro of await listIntroductions(eventId)) {
      out.considered += 1;
      const decision = shouldFollowUp(intro, { now, eventStartsAt: startsAt });
      if (!decision.send) {
        out.skipped[decision.reason] = (out.skipped[decision.reason] ?? 0) + 1;
        continue;
      }
      if (!(await send(intro).catch(() => false))) {
        out.skipped["send failed"] = (out.skipped["send failed"] ?? 0) + 1;
        continue;
      }
      await raw()
        .from("event_introductions")
        .update({ follow_ups: intro.followUps + 1, last_follow_up_at: now.toISOString() })
        .eq("id", intro.id);
      out.sent += 1;
    }
  }
  return out;
}

/** Subject and body for one introduction, from the stored templates. */
export function renderIntro(
  template: IntroTemplate,
  input: Parameters<typeof introVars>[0],
): { subject: string; body: string } {
  const vars = introVars(input);
  return {
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  };
}
