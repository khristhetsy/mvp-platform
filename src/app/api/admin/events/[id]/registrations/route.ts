import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createManualRegistration } from "@/lib/icfo-events/registrations";

export const dynamic = "force-dynamic";

const schema = z.object({
  attendeeType: z.enum(["investor", "founder", "service", "sponsor"]),
  answers: z.record(z.string(), z.unknown()).default({}),
});

/** Manually register a guest for an event (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = typeof parsed.data.answers.email === "string" ? parsed.data.answers.email.trim() : "";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    const registration = await createManualRegistration(auth.supabase, id, parsed.data);
    return NextResponse.json({ registration }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to register the guest." }, { status: 500 });
  }
}
