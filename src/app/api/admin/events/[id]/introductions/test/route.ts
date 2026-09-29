import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard } from "@/lib/icfo-events/networking-board";
import { contactsFor, listTemplates } from "@/lib/icfo-events/introductions-server";
import { sendIntroductionDigest, sendIntroductionEmail } from "@/lib/icfo-events/introduction-emails";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import type { Role } from "@/lib/icfo-events/pair-types";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** A test is a rehearsal, not a send: never more than one investor's worth. */
const MAX_DIGEST_ROWS = 5;

const schema = z.object({ to: z.string().email() });

/**
 * Send yourself the invitation exactly as it would go out.
 *
 * Built from a real match on this event rather than invented data, because the
 * point is to see what the tokens actually produce — including a founder who
 * left their pitch blank, where the line disappears rather than leaving a gap.
 *
 * It creates no introduction, changes no status, and mails nobody but you. Its
 * buttons carry no introduction id, so they land on a page that says as much.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: eventId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That is not an email address." }, { status: 400 });

    const [event, board, templates] = await Promise.all([
      getEventById(auth.supabase, eventId).catch(() => null),
      loadNetworkingBoard(eventId),
      listTemplates(),
    ]);
    const invitation = templates.find((t) => t.kind === "invitation");
    if (!invitation) {
      return NextResponse.json({ error: "There is no invitation template to test." }, { status: 400 });
    }
    if (!event) return NextResponse.json({ error: "That event no longer exists." }, { status: 404 });

    // The strongest match nobody has been introduced for — board pairs are
    // already sorted by score.
    const top = board.pairs.find((p) => p.status === "none");
    if (!top) {
      return NextResponse.json(
        { error: "Nothing left to introduce on this event, so there is nothing to rehearse." },
        { status: 400 },
      );
    }

    // Whatever that investor would really receive: one email, or their digest.
    const theirs = board.pairs
      .filter((p) => p.status === "none" && p.a.registrationId === top.a.registrationId)
      .slice(0, MAX_DIGEST_ROWS);

    const people = await contactsFor([
      top.a.registrationId,
      ...theirs.map((p) => p.b.registrationId),
    ]);
    const investor = people.get(top.a.registrationId);

    const founderOf = (
      regId: string, fallbackName: string, fallbackCompany: string | null, role: Role = "founder",
    ) => {
      const c = people.get(regId);
      return {
        role,
        name: c?.name ?? fallbackName,
        company: c?.company ?? fallbackCompany,
        pitch: c?.pitch ?? null,
        stage: c?.stage ?? null,
        raising: c?.raising ?? null,
        roundSize: c?.roundSize ?? null,
      };
    };

    const eventWhen = event.startsAt ? formatSlot(event.startsAt, event.timezone ?? null) : null;
    const to = parsed.data.to;
    const shape = theirs.length > 1 ? "digest" : "single";

    const ok = shape === "digest"
      ? await sendIntroductionDigest({
          to,
          investorName: investor?.name ?? top.a.name,
          eventTitle: event.title,
          eventWhen,
          items: theirs.map((p) => ({
            introductionId: `test-${p.key}`,
            founder: founderOf(p.b.registrationId, p.b.name, p.b.company, p.b.role),
            role: p.b.role,
            sharedSectors: p.sharedInterests,
          })),
          baseUrl: BASE_URL,
          test: true,
        })
      : await sendIntroductionEmail({
          introductionId: `test-${top.key}`,
          to,
          template: invitation,
          investor: { name: investor?.name ?? top.a.name, company: investor?.company ?? top.a.company },
          founder: founderOf(top.b.registrationId, top.b.name, top.b.company, top.b.role),
          eventTitle: event.title,
          eventWhen,
          sharedSectors: top.sharedInterests,
          baseUrl: BASE_URL,
          test: true,
        });

    if (!ok) {
      return NextResponse.json(
        { error: "The email could not be sent — check that email is configured." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      to,
      shape,
      rows: shape === "digest" ? theirs.length : 1,
      // Named so you know whose answers you are looking at.
      investor: investor?.name ?? top.a.name,
      founder: people.get(top.b.registrationId)?.name ?? top.b.name,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "The test send failed." }, { status: 500 });
  }
}
