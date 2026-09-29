/**
 * Chase presenters who accepted but haven't sent their materials in.
 *
 * Two sends, at 7 and 2 days before the due date, then silence — a reminder
 * that keeps arriving after there's nothing left to do is how people learn to
 * ignore them. `last_reminded_at` is what stops a second send in the same
 * window when the sweep runs more than once a day.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { outstandingMaterials, respondPath, type InviteRole } from "./invite-rules";
import { inviteToken } from "./invites";
import { sendMaterialsReminder } from "./invite-emails";
import type { PresenterInvite } from "./invites";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** Days before the due date that earn a send. */
export const REMINDER_DAYS = [7, 2] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` to a yyyy-mm-dd due date, negative once overdue. */
export function daysUntil(due: string, now: Date = new Date()): number {
  const target = new Date(`${due}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY_MS);
}

/**
 * Whether this invitation earns a reminder right now. Pure, so the windowing —
 * the part that quietly sends twice or never — is directly testable.
 */
export function shouldRemind(
  input: { materialsDue: string | null; lastRemindedAt: string | null },
  now: Date = new Date(),
): boolean {
  if (!input.materialsDue) return false;
  const left = daysUntil(input.materialsDue, now);
  if (!REMINDER_DAYS.includes(left as (typeof REMINDER_DAYS)[number])) return false;
  // One send per window: a sweep running hourly must not send seven times.
  if (input.lastRemindedAt && now.getTime() - new Date(input.lastRemindedAt).getTime() < DAY_MS) return false;
  return true;
}

type Row = Record<string, unknown>;

export async function runInviteReminderPass(now: Date = new Date()): Promise<{ sent: number; checked: number }> {
  const db = raw();
  const { data } = await db
    .from("event_presenter_invites")
    .select("*, events(title, slug)")
    .eq("status", "accepted")
    .not("materials_due", "is", null);

  const rows = (data ?? []) as Row[];
  let sent = 0;

  for (const r of rows) {
    const due = (r.materials_due as string | null) ?? null;
    const last = (r.last_reminded_at as string | null) ?? null;
    if (!shouldRemind({ materialsDue: due, lastRemindedAt: last }, now)) continue;

    const presenterId = (r.presenter_id as string | null) ?? null;
    if (!presenterId) continue;

    const { data: p } = await db
      .from("event_presenters")
      .select("video_url, deck_path")
      .eq("id", presenterId)
      .maybeSingle();

    const role = r.kind as InviteRole;
    const missing = outstandingMaterials(role, {
      videoUrl: ((p as Row | null)?.video_url as string | null) ?? null,
      deckPath: ((p as Row | null)?.deck_path as string | null) ?? null,
    });
    // Nothing outstanding — the reminder stops on its own.
    if (!missing.length) continue;

    const ev = r.events as { title?: string | null; slug?: string | null } | null | undefined;
    const invite: PresenterInvite = {
      id: String(r.id),
      eventId: String(r.event_id),
      sessionId: (r.session_id as string | null) ?? null,
      presenterId,
      profileId: (r.profile_id as string | null) ?? null,
      role,
      email: String(r.email),
      displayName: (r.display_name as string | null) ?? null,
      status: "accepted",
      note: null,
      materialsDue: due,
      invitedAt: String(r.invited_at),
      respondedAt: null,
      declineReason: null,
      eventTitle: ev?.title ?? null,
      eventSlug: ev?.slug ?? null,
    };

    const token = inviteToken(invite.id, r.token_nonce as string);
    const path = respondPath(role, Boolean(invite.profileId), token);

    try {
      if (await sendMaterialsReminder(invite, path, missing)) {
        await db
          .from("event_presenter_invites")
          .update({ last_reminded_at: now.toISOString() })
          .eq("id", invite.id);
        sent += 1;
      }
    } catch {
      /* one bad address must not stop the sweep */
    }
  }

  return { sent, checked: rows.length };
}
