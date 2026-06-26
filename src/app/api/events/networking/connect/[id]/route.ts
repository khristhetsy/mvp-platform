import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/notifications";
import { respondToConnection } from "@/lib/icfo-events/networking";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

/** Recipient accepts or declines a connection request. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const accept = parsed.data.action === "accept";

    const supabase = await createServerSupabaseClient();
    // Find the request (RLS lets the recipient read it) to notify the original requester.
    const { data } = await supabase
      .from("networking_connections")
      .select("from_id, event_id")
      .eq("id", id)
      .maybeSingle() as { data: { from_id: string; event_id: string } | null };

    await respondToConnection(supabase, id, profile.id, accept);

    if (accept && data) {
      await createNotification({
        recipientUserId: data.from_id,
        actorUserId: profile.id,
        type: "event_connection_accepted",
        title: "Connection accepted",
        message: `${profile.full_name ?? "Your request"} accepted your connection request.`,
        entityType: "networking_connection",
        entityId: id,
        deepLink: "/events",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to respond." }, { status: 500 });
  }
}
