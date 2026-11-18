import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { registrationFromNetworkingToken, setNetworkingChoice } from "@/lib/icfo-events/networking-choice";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10).max(600),
  optedIn: z.boolean(),
});

/**
 * Say yes or no to networking from the registration email.
 *
 * No sign in: most registrants are guests. The signed link is the authorization,
 * and it only reaches one registration.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const registrationId = registrationFromNetworkingToken(parsed.data.token);
  if (!registrationId) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });

  try {
    const result = await setNetworkingChoice(registrationId, parsed.data.optedIn);
    if (!result) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
    return NextResponse.json({ ok: true, optedIn: parsed.data.optedIn, eventTitle: result.eventTitle });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not save your choice." }, { status: 500 });
  }
}
