import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { deleteRegistrations } from "@/lib/icfo-events/registrations";
import { registrationImpact } from "@/lib/icfo-events/impact";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one registration.").max(1000),
  /** Count what would go with them, and delete nothing. */
  dryRun: z.boolean().default(false),
});

/**
 * Delete several registrations at once (staff), across events.
 *
 * Two steps on purpose: the dialog asks with `dryRun` first, so the numbers it
 * shows are read when it opens and not when the page loaded. Only the
 * registration rows go. A person's account is never touched, and nobody is
 * emailed that they were removed.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];

  try {
    if (parsed.data.dryRun) {
      return NextResponse.json({ impact: await registrationImpact(ids) });
    }
    const deleted = await deleteRegistrations(auth.supabase, ids);
    return NextResponse.json({ deleted });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't delete the registrations." }, { status: 500 });
  }
}
