import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getDraft, upsertDraft } from "@/lib/event-email/drafts";
import type { EventEmailType } from "@/lib/event-email/merge";
import type { TemplateBlock } from "@/lib/marketing/template-blocks";
import type { TemplateTheme } from "@/lib/marketing/template-theme";

export const dynamic = "force-dynamic";

const TYPES: EventEmailType[] = ["invite", "reminder", "day_of", "booklet"];
const asType = (v: string | null): EventEmailType | null => (TYPES as string[]).includes(v ?? "") ? (v as EventEmailType) : null;

/** Load the saved inline-edit draft for an event + email type. */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const eventId = req.nextUrl.searchParams.get("eventId");
    const type = asType(req.nextUrl.searchParams.get("type"));
    if (!eventId || !type) return NextResponse.json({ error: "Missing eventId or type." }, { status: 400 });
    const draft = await getDraft(auth.supabase, eventId, type);
    return NextResponse.json({ draft });
  } catch (err) {
    Sentry.captureException(err);
    // Pre-migration (table missing) → behave as "no draft" rather than erroring the wizard.
    return NextResponse.json({ draft: null });
  }
}

/** Save the inline-edit draft (block document + theme). */
export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      type?: EventEmailType;
      subject?: string | null;
      blocks?: TemplateBlock[] | null;
      theme?: TemplateTheme | null;
      includeBanner?: boolean | null;
      includeLobby?: boolean | null;
    };
    const type = asType(body.type ?? null);
    if (!body.eventId || !type) return NextResponse.json({ error: "Missing eventId or type." }, { status: 400 });
    await upsertDraft(auth.supabase, {
      eventId: body.eventId,
      emailType: type,
      subject: body.subject ?? null,
      blocks: body.blocks ?? null,
      theme: body.theme ?? null,
      includeBanner: body.includeBanner ?? null,
      includeLobby: body.includeLobby ?? null,
      updatedBy: auth.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save draft. ${detail.slice(0, 160)}` }, { status: 500 });
  }
}
