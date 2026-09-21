import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteFromToken, saveMaterials } from "@/lib/icfo-events/invites";
import { INVITE_ROLES } from "@/lib/icfo-events/invite-rules";
import { validateFile, PDF_ONLY } from "@/lib/uploads/policy";

export const dynamic = "force-dynamic";

const BUCKET = "document_upload";

/**
 * Pitch-deck upload for an invited presenter.
 *
 * The same two ways in as /respond: a signed token (exhibitors, no account) or
 * a signed-in founder who owns the invitation. Format and size are checked with
 * the shared PDF_ONLY policy so this can never drift from the 25MB rule the
 * rest of the platform uses — and it is checked HERE, on the server, because a
 * client-side check is a convenience, not a control.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });

  const token = typeof form.get("token") === "string" ? (form.get("token") as string) : undefined;
  const inviteId = typeof form.get("inviteId") === "string" ? (form.get("inviteId") as string) : undefined;
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });

  // ── who is asking ──
  let invite = token ? await inviteFromToken(token) : null;
  if (!invite && inviteId) {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
    // RLS scopes this to the caller's own invitations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("event_presenter_invites")
      .select("id, kind, status, presenter_id, event_id")
      .eq("id", inviteId)
      .maybeSingle();
    if (data) {
      const r = data as Record<string, unknown>;
      invite = {
        id: String(r.id), eventId: String(r.event_id), sessionId: null,
        presenterId: (r.presenter_id as string | null) ?? null, profileId: null,
        role: r.kind as keyof typeof INVITE_ROLES, email: "", displayName: null,
        status: r.status as "invited" | "accepted" | "declined" | "withdrawn",
        note: null, materialsDue: null, invitedAt: "", respondedAt: null, declineReason: null,
      };
    }
  }
  if (!invite) return NextResponse.json({ error: "This link is no longer valid." }, { status: 403 });
  if (invite.status !== "accepted" || !invite.presenterId) {
    return NextResponse.json({ error: "Accept the invitation first." }, { status: 409 });
  }
  if (!INVITE_ROLES[invite.role].wantsDeck) {
    return NextResponse.json({ error: "A deck isn't part of this role." }, { status: 400 });
  }

  // ── PDF only, 25MB — the shared policy, its own wording ──
  const check = validateFile({ name: file.name, type: file.type, size: file.size }, PDF_ONLY);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });

  const admin = createServiceRoleClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `event-decks/${invite.eventId}/${invite.presenterId}/${Date.now()}-${safeName}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    return NextResponse.json(
      { error: "Upload failed. Please try again." , detail: error.message },
      { status: 502 },
    );
  }

  await saveMaterials(invite.presenterId, {
    deckPath: path,
    deckFilename: file.name,
    deckBytes: file.size,
  });

  return NextResponse.json({ ok: true, deckPath: path, deckFilename: file.name, deckBytes: file.size });
}
