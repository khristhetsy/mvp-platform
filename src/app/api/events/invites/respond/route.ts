import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  acceptInvite,
  declineInvite,
  getMaterials,
  inviteFromToken,
  saveMaterials,
  type PresenterInvite,
} from "@/lib/icfo-events/invites";
import { INVITE_ROLES, validateVideoUrl } from "@/lib/icfo-events/invite-rules";

export const dynamic = "force-dynamic";

/**
 * Respond to an invitation, or save materials against it.
 *
 * Two ways in, and exactly one of them has to hold:
 *   · a signed token — how an exhibitor with no account answers;
 *   · a signed-in founder whose profile owns the invitation.
 *
 * The token is verified against the row's stored nonce, so a link that was
 * revoked stops working even though its signature is still intact.
 */
async function authorize(
  token: string | undefined,
  inviteId: string | undefined,
): Promise<{ invite: PresenterInvite } | { error: Response }> {
  if (token) {
    const invite = await inviteFromToken(token);
    if (!invite) {
      return { error: NextResponse.json({ error: "This link is no longer valid." }, { status: 403 }) };
    }
    return { invite };
  }

  if (!inviteId) {
    return { error: NextResponse.json({ error: "Missing invitation." }, { status: 400 }) };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Sign in to respond." }, { status: 401 }) };

  // RLS restricts this select to the caller's own invitations, so a matching
  // row is itself the ownership proof.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("event_presenter_invites")
    .select("*, events(title, slug)")
    .eq("id", inviteId)
    .maybeSingle();
  if (!data) return { error: NextResponse.json({ error: "Invitation not found." }, { status: 404 }) };

  const r = data as Record<string, unknown>;
  const ev = r.events as { title?: string | null; slug?: string | null } | null | undefined;
  return {
    invite: {
      id: String(r.id),
      eventId: String(r.event_id),
      sessionId: (r.session_id as string | null) ?? null,
      presenterId: (r.presenter_id as string | null) ?? null,
      profileId: (r.profile_id as string | null) ?? null,
      role: r.kind as PresenterInvite["role"],
      email: String(r.email),
      displayName: (r.display_name as string | null) ?? null,
      status: r.status as PresenterInvite["status"],
      note: (r.note as string | null) ?? null,
      materialsDue: (r.materials_due as string | null) ?? null,
      invitedAt: String(r.invited_at),
      respondedAt: (r.responded_at as string | null) ?? null,
      declineReason: (r.decline_reason as string | null) ?? null,
      eventTitle: ev?.title ?? null,
      eventSlug: ev?.slug ?? null,
    },
  };
}

type Body = {
  token?: string;
  inviteId?: string;
  action?: "accept" | "decline" | "materials";
  reason?: string;
  videoUrl?: string | null;
  deckPath?: string | null;
  deckFilename?: string | null;
  deckBytes?: number | null;
};

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Body | null;
  const authed = await authorize(body?.token, body?.inviteId);
  if ("error" in authed) return authed.error;
  const { invite } = authed;

  if (invite.status === "withdrawn") {
    return NextResponse.json({ error: "This invitation has been withdrawn." }, { status: 409 });
  }

  switch (body?.action) {
    case "accept": {
      const { presenterId } = await acceptInvite(invite.id);
      return NextResponse.json({ ok: true, presenterId, materials: await getMaterials(presenterId) });
    }

    case "decline": {
      await declineInvite(invite.id, body.reason ?? null);
      return NextResponse.json({ ok: true });
    }

    case "materials": {
      if (invite.status !== "accepted" || !invite.presenterId) {
        return NextResponse.json({ error: "Accept the invitation first." }, { status: 409 });
      }
      const spec = INVITE_ROLES[invite.role];
      const patch: Parameters<typeof saveMaterials>[1] = {};

      if (body.videoUrl !== undefined) {
        if (!spec.wantsVideo) {
          return NextResponse.json({ error: "A pitch video isn't part of this role." }, { status: 400 });
        }
        if (body.videoUrl === null || body.videoUrl === "") {
          patch.videoUrl = null;
        } else {
          const check = validateVideoUrl(body.videoUrl);
          if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
          patch.videoUrl = check.url;
        }
      }

      if (body.deckPath !== undefined) {
        if (!spec.wantsDeck) {
          return NextResponse.json({ error: "A deck isn't part of this role." }, { status: 400 });
        }
        patch.deckPath = body.deckPath;
        patch.deckFilename = body.deckFilename ?? null;
        patch.deckBytes = body.deckBytes ?? null;
      }

      await saveMaterials(invite.presenterId, patch);
      return NextResponse.json({ ok: true, materials: await getMaterials(invite.presenterId) });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
