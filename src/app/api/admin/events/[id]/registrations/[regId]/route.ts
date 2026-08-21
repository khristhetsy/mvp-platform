import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setRegistrationContact } from "@/lib/icfo-events/registrations";

export const dynamic = "force-dynamic";

const schema = z.object({
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
});

/** Edit a registrant's contact details (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { regId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    const registration = await setRegistrationContact(auth.supabase, regId, parsed.data);
    return NextResponse.json({ registration });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update registration." }, { status: 500 });
  }
}
