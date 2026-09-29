import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createInvite, listEventInvites } from "@/lib/icfo-events/invites";
import { isInviteRole } from "@/lib/icfo-events/invite-rules";
import { sendInviteEmail } from "@/lib/icfo-events/invite-emails";

export const dynamic = "force-dynamic";

/** Everyone invited to this event, with what they still owe. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("view_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ invites: await listEventInvites(id) });
}

type Body = {
  emails?: string;
  role?: string;
  sessionId?: string | null;
  materialsDue?: string | null;
  note?: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite one or more people. Each address is its own invitation, so one bad
 * entry or one duplicate does not lose the rest — the response reports per
 * address rather than failing the batch.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: eventId } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  const role = body?.role;
  if (!isInviteRole(role)) return NextResponse.json({ error: "Pick a role for this invitation." }, { status: 400 });

  const addresses = [...new Set(
    (body?.emails ?? "")
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )];
  if (!addresses.length) return NextResponse.json({ error: "Add at least one email address." }, { status: 400 });

  const sent: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const email of addresses) {
    if (!EMAIL.test(email)) {
      failed.push({ email, reason: "Not a valid email address." });
      continue;
    }
    try {
      const { invite, url } = await createInvite({
        eventId,
        role,
        email,
        sessionId: body?.sessionId ?? null,
        materialsDue: body?.materialsDue ?? null,
        note: body?.note ?? null,
        invitedBy: auth.profile.id,
      });
      // A failed send must not leave a silent invitation nobody received.
      await sendInviteEmail(invite, url);
      sent.push(email);
    } catch (e) {
      failed.push({ email, reason: e instanceof Error ? e.message : "Could not invite." });
    }
  }

  return NextResponse.json({ sent, failed }, { status: failed.length && !sent.length ? 400 : 200 });
}
