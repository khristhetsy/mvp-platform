// Presenter invitations — create, respond, and the materials a presenter hands
// in. The decisions that don't need a database live in `invite-rules.ts`.
//
// Server only: the exhibitor flow has no session at all (possession of the
// signed link is the authorization), so those reads go through the service role
// after the token is verified.
import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";
import {
  INVITE_ROLES,
  materialsComplete,
  outstandingMaterials,
  respondPath,
  type InviteRole,
} from "./invite-rules";

/** The invite tables aren't in the generated types yet. */
function raw(db?: SupabaseClient<Database>): SupabaseClient {
  return (db ?? createServiceRoleClient()) as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export type InviteStatus = "invited" | "accepted" | "declined" | "withdrawn";

export type PresenterInvite = {
  id: string;
  eventId: string;
  sessionId: string | null;
  presenterId: string | null;
  profileId: string | null;
  role: InviteRole;
  email: string;
  displayName: string | null;
  status: InviteStatus;
  note: string | null;
  materialsDue: string | null;
  invitedAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  /** Joined for display. */
  eventTitle?: string | null;
  eventSlug?: string | null;
};

function mapInvite(r: Row): PresenterInvite {
  const event = r.events as { title?: string | null; slug?: string | null } | null | undefined;
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    sessionId: (r.session_id as string | null) ?? null,
    presenterId: (r.presenter_id as string | null) ?? null,
    profileId: (r.profile_id as string | null) ?? null,
    role: r.kind as InviteRole,
    email: String(r.email),
    displayName: (r.display_name as string | null) ?? null,
    status: r.status as InviteStatus,
    note: (r.note as string | null) ?? null,
    materialsDue: (r.materials_due as string | null) ?? null,
    invitedAt: String(r.invited_at),
    respondedAt: (r.responded_at as string | null) ?? null,
    declineReason: (r.decline_reason as string | null) ?? null,
    eventTitle: event?.title ?? null,
    eventSlug: event?.slug ?? null,
  };
}

// ── Links ────────────────────────────────────────────────────────────────────

const ACTION = "respond";

/**
 * The signed link for one invitation. The row's `token_nonce` is mixed in, so
 * rotating that column revokes every outstanding link without losing the
 * invitation's history.
 */
export function inviteToken(inviteId: string, nonce: string, expiresAt?: number): string {
  return makeToken({ kind: "event_invite", id: inviteId, action: ACTION, nonce, expiresAt });
}

/**
 * The invitation a token opens, or null. Verifies the signature first, then
 * re-checks the nonce against the stored row — a token that was valid before a
 * revocation must not still work.
 */
export async function inviteFromToken(token: string): Promise<PresenterInvite | null> {
  // The nonce lives on the row, so the id has to be read out of the payload
  // before the signature can be checked against it. Nothing here trusts that
  // read: the verify below is what decides, and it fails for a forged payload
  // because the signature won't match.
  let id: string;
  try {
    const body = token.split(".")[0];
    if (!body) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { id?: unknown };
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    id = parsed.id;
  } catch {
    return null;
  }

  const { data } = await raw()
    .from("event_presenter_invites")
    .select("*, events(title, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const nonce = (data as Row).token_nonce as string;
  if (verifyToken({ token, kind: "event_invite", action: ACTION, nonce }) !== id) return null;
  return mapInvite(data as Row);
}

/** Revoke every outstanding link for an invitation, keeping its history. */
export async function rotateInviteToken(inviteId: string): Promise<void> {
  await raw()
    .from("event_presenter_invites")
    .update({ token_nonce: randomUUID(), updated_at: new Date().toISOString() })
    .eq("id", inviteId);
}

// ── Create ───────────────────────────────────────────────────────────────────

export type CreateInviteInput = {
  eventId: string;
  role: InviteRole;
  email: string;
  displayName?: string | null;
  sessionId?: string | null;
  materialsDue?: string | null;
  note?: string | null;
  invitedBy?: string | null;
};

export type CreatedInvite = {
  invite: PresenterInvite;
  /** Where this person should be sent — portal or signed link. */
  url: string;
};

/**
 * Invite one person. An email that matches an iCapOS profile is linked, which
 * is what routes them to the portal instead of a tokenless page.
 */
export async function createInvite(input: CreateInviteInput): Promise<CreatedInvite> {
  const db = raw();
  const email = input.email.trim().toLowerCase();

  const { data: profile } = await db.from("profiles").select("id, full_name").eq("email", email).maybeSingle();
  const profileId = (profile as { id?: string } | null)?.id ?? null;

  const { data, error } = await db
    .from("event_presenter_invites")
    .insert({
      event_id: input.eventId,
      session_id: input.sessionId ?? null,
      profile_id: profileId,
      kind: input.role,
      email,
      display_name: input.displayName ?? (profile as { full_name?: string } | null)?.full_name ?? null,
      note: input.note ?? null,
      materials_due: input.materialsDue ?? null,
      invited_by: input.invitedBy ?? null,
    })
    .select("*, events(title, slug)")
    .single();

  if (error) {
    // The partial unique index is the guard; turn it into something readable.
    if (error.code === "23505") throw new Error(`${email} already has an open invitation to this event.`);
    throw new Error(error.message);
  }

  const invite = mapInvite(data as Row);
  const token = inviteToken(invite.id, (data as Row).token_nonce as string);
  return { invite, url: respondPath(invite.role, Boolean(profileId), token) };
}

// ── Respond ──────────────────────────────────────────────────────────────────

/**
 * Accept an invitation. Creates the presenter row if there isn't one, so the
 * materials have somewhere to land, and returns it.
 */
export async function acceptInvite(inviteId: string): Promise<{ presenterId: string }> {
  const db = raw();
  const { data: inviteRow } = await db
    .from("event_presenter_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();
  if (!inviteRow) throw new Error("Invitation not found.");
  const invite = mapInvite(inviteRow as Row);
  if (invite.status === "withdrawn") throw new Error("This invitation has been withdrawn.");

  let presenterId = invite.presenterId;
  if (!presenterId) {
    const { data: presenter, error } = await db
      .from("event_presenters")
      .insert({
        event_id: invite.eventId,
        session_id: invite.sessionId,
        profile_id: invite.profileId,
        display_name: invite.displayName ?? invite.email,
        role_label: INVITE_ROLES[invite.role].label,
        email: invite.email,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    presenterId = String((presenter as { id: string }).id);
  }

  await db
    .from("event_presenter_invites")
    .update({
      status: "accepted",
      presenter_id: presenterId,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  return { presenterId };
}

export async function declineInvite(inviteId: string, reason?: string | null): Promise<void> {
  await raw()
    .from("event_presenter_invites")
    .update({
      status: "declined",
      decline_reason: reason?.trim() || null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId);
}

export async function withdrawInvite(inviteId: string): Promise<void> {
  await raw()
    .from("event_presenter_invites")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", inviteId);
}

// ── Materials ────────────────────────────────────────────────────────────────

export type PresenterMaterials = {
  videoUrl: string | null;
  deckPath: string | null;
  deckFilename: string | null;
  deckBytes: number | null;
  updatedAt: string | null;
};

export async function getMaterials(presenterId: string): Promise<PresenterMaterials | null> {
  const { data } = await raw()
    .from("event_presenters")
    .select("video_url, deck_path, deck_filename, deck_bytes, materials_updated_at")
    .eq("id", presenterId)
    .maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return {
    videoUrl: (r.video_url as string | null) ?? null,
    deckPath: (r.deck_path as string | null) ?? null,
    deckFilename: (r.deck_filename as string | null) ?? null,
    deckBytes: (r.deck_bytes as number | null) ?? null,
    updatedAt: (r.materials_updated_at as string | null) ?? null,
  };
}

export async function saveMaterials(
  presenterId: string,
  patch: Partial<{ videoUrl: string | null; deckPath: string | null; deckFilename: string | null; deckBytes: number | null }>,
): Promise<void> {
  const update: Row = { materials_updated_at: new Date().toISOString() };
  if (patch.videoUrl !== undefined) update.video_url = patch.videoUrl;
  if (patch.deckPath !== undefined) update.deck_path = patch.deckPath;
  if (patch.deckFilename !== undefined) update.deck_filename = patch.deckFilename;
  if (patch.deckBytes !== undefined) update.deck_bytes = patch.deckBytes;
  await raw().from("event_presenters").update(update).eq("id", presenterId);
}

// ── Stage link ───────────────────────────────────────────────────────────────

export type StageLink =
  | { state: "ready"; url: string }
  | { state: "not_yet"; reason: string }
  | { state: "no_session"; reason: string };

/**
 * The room a presenter joins.
 *
 * Deliberately resolved at read time from the session rather than stored on the
 * invitation: an event's Whereby room is created when the session goes live and
 * is valid for 24 hours, so a link minted at invite time would point at nothing
 * and then expire. Before the session opens there is genuinely no link, and the
 * page says so rather than showing an empty box.
 */
export async function stageLink(sessionId: string | null): Promise<StageLink> {
  if (!sessionId) {
    return {
      state: "no_session",
      reason: "You're not assigned to a session yet. We'll email your link once you are.",
    };
  }
  const { data } = await raw().from("sessions").select("video_ref, status").eq("id", sessionId).maybeSingle();
  const ref = (data as Row | null)?.video_ref as string | null | undefined;
  if (!ref) {
    return {
      state: "not_yet",
      reason: "Your stage link appears here when the session opens, about 15 minutes before it starts. We'll email it to you too.",
    };
  }
  return { state: "ready", url: ref };
}

// ── Reading for the admin tracker ────────────────────────────────────────────

export type InviteWithMaterials = PresenterInvite & {
  materials: PresenterMaterials | null;
  outstanding: string[];
  complete: boolean;
};

export async function listEventInvites(eventId: string): Promise<InviteWithMaterials[]> {
  const db = raw();
  const { data } = await db
    .from("event_presenter_invites")
    .select("*, events(title, slug)")
    .eq("event_id", eventId)
    .order("invited_at", { ascending: false });

  const invites = ((data ?? []) as Row[]).map(mapInvite);
  const presenterIds = invites.map((i) => i.presenterId).filter((x): x is string => Boolean(x));

  const byPresenter = new Map<string, PresenterMaterials>();
  if (presenterIds.length) {
    const { data: rows } = await db
      .from("event_presenters")
      .select("id, video_url, deck_path, deck_filename, deck_bytes, materials_updated_at")
      .in("id", presenterIds);
    for (const r of (rows ?? []) as Row[]) {
      byPresenter.set(String(r.id), {
        videoUrl: (r.video_url as string | null) ?? null,
        deckPath: (r.deck_path as string | null) ?? null,
        deckFilename: (r.deck_filename as string | null) ?? null,
        deckBytes: (r.deck_bytes as number | null) ?? null,
        updatedAt: (r.materials_updated_at as string | null) ?? null,
      });
    }
  }

  return invites.map((i) => {
    const materials = i.presenterId ? byPresenter.get(i.presenterId) ?? null : null;
    const m = { videoUrl: materials?.videoUrl ?? null, deckPath: materials?.deckPath ?? null };
    return {
      ...i,
      materials,
      outstanding: outstandingMaterials(i.role, m),
      complete: materialsComplete(i.role, m),
    };
  });
}

/** Open invitations for one founder, for the portal. */
export async function listInvitesForProfile(profileId: string): Promise<PresenterInvite[]> {
  const { data } = await raw()
    .from("event_presenter_invites")
    .select("*, events(title, slug)")
    .eq("profile_id", profileId)
    .in("status", ["invited", "accepted"])
    .order("invited_at", { ascending: false });
  return ((data ?? []) as Row[]).map(mapInvite);
}
