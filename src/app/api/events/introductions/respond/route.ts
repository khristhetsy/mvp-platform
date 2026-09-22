import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { introFromToken, respondToIntroduction, attachRoom, listIntroductions } from "@/lib/icfo-events/introductions-server";
import { createIntroductionRoom, meetingLinksAvailable } from "@/lib/icfo-events/meeting-links";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10), accept: z.boolean() });

/**
 * Accept or decline an introduction from the signed link in the email.
 *
 * No login: most attendees at a large event registered as guests, and an
 * introduction they cannot answer is worthless. The token carries the id and
 * is signed, so possession of the link is the authorisation.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const id = introFromToken(parsed.data.token);
    if (!id) return NextResponse.json({ error: "That link is no longer valid." }, { status: 403 });

    const result = await respondToIntroduction(id, parsed.data.accept);
    if (!("ok" in result) || !result.ok) {
      return NextResponse.json({ error: "error" in result ? result.error : "Could not save." }, { status: 400 });
    }
    if (!parsed.data.accept) return NextResponse.json({ accepted: false });

    // Mint the room from our own provider, so neither party needs an account
    // anywhere. A failure here does not undo the acceptance.
    let roomUrl: string | null = null;
    let roomError: string | null = null;
    if (meetingLinksAvailable()) {
      const room = await createIntroductionRoom({ introductionId: id, title: "iCFO Events introduction" });
      if (room.ok) {
        roomUrl = room.room.url;
        await attachRoom(id, room.room.url, room.room.expiresAt);
      } else {
        roomError = room.reason;
      }
    } else {
      roomError = "Video rooms aren't configured yet.";
    }

    return NextResponse.json({ accepted: true, alreadyAnswered: result.alreadyAnswered, roomUrl, roomError });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** The introduction behind a token, for rendering the page. */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const id = introFromToken(token);
  if (!id) return NextResponse.json({ error: "That link is no longer valid." }, { status: 403 });
  return NextResponse.json({ id });
}
