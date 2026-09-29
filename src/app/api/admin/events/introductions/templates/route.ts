import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listTemplates, saveTemplate } from "@/lib/icfo-events/introductions-server";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["invitation", "peer_invitation", "follow_up"]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ templates: await listTemplates() });
}

/** Edit the invitation or the founder follow-up. */
export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const { kind, subject, body } = parsed.data;
    const result = await saveTemplate(kind, { subject, body }, auth.profile.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't save the template." }, { status: 500 });
  }
}
