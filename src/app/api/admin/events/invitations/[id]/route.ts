import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { deleteDraft, getCampaign, saveCampaign, scheduleCampaign, setCampaignStatus } from "@/lib/icfo-events/invitations/store";
import { getLiveCounts } from "@/lib/icfo-events/invitations/live-stats";
import { emailEvent, loadEvents, statEventIds } from "@/lib/icfo-events/invitations/runner";
import { renderInviteEmail, INVITE_STEPS, type InviteStep } from "@/lib/icfo-events/invitations/emails";
import { sendMarketingEmail, makeUnsubscribeToken } from "@/lib/marketing/send";
import { INVITE_ROLES, OFFERS, STAT_ORDER, statTiles, type InviteRole } from "@/lib/icfo-events/invitations/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  try {
    const campaign = await saveCampaign(id, {
      name: String(body.name ?? ""),
      eventIds: Array.isArray(body.eventIds) ? body.eventIds.map(String) : [],
      audiences: body.audiences,
      scheduleAt: typeof body.scheduleAt === "string" ? body.scheduleAt : null,
      stats: body.stats,
      fromName: typeof body.fromName === "string" ? body.fromName : null,
      fromEmail: typeof body.fromEmail === "string" ? body.fromEmail : null,
    }, auth.userId);
    return NextResponse.json({ campaign });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteDraft(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete." }, { status: 400 });
  }
}

/**
 * Actions: schedule, pause, resume, preview (renders one role and step with the
 * real numbers and a sample name), test (sends that email to you).
 */
export async function POST(req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string; role?: string; step?: string } | null;
  try {
    if (body?.action === "schedule") return NextResponse.json(await scheduleCampaign(id, auth.userId));
    if (body?.action === "pause") { await setCampaignStatus(id, "paused"); return NextResponse.json({ ok: true }); }
    if (body?.action === "resume") { await setCampaignStatus(id, "scheduled"); return NextResponse.json({ ok: true }); }
    if (body?.action === "preview" || body?.action === "test") {
      const c = await getCampaign(id);
      if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
      const role: InviteRole = (INVITE_ROLES as readonly string[]).includes(body.role ?? "") ? (body.role as InviteRole) : "founder";
      const step: InviteStep = (INVITE_STEPS as readonly string[]).includes(body.step ?? "") ? (body.step as InviteStep) : "invite";
      const events = (await loadEvents(c.eventIds)).filter((e) => Date.parse(e.startsAt) > Date.now());
      const tiles = statTiles(await getLiveCounts(statEventIds(c, events)), c.stats, STAT_ORDER[role]);
      const audience = c.audiences.find((a) => a.role === role);
      const firstName = (auth.profile.full_name ?? "").split(" ")[0] || "Maya";
      const email = renderInviteEmail({
        role, step, firstName,
        events: events.map(emailEvent),
        offers: audience?.offers ?? OFFERS[role].map((o) => o.key),
        tiles,
        // Preview shows the fallback table; the live image needs a real invitation.
        statsImageUrl: null,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com"}/events`,
        subjectOverride: audience?.subject,
        introOverride: audience?.intro,
      });
      if (body.action === "preview") return NextResponse.json(email);
      const to = auth.profile.email;
      if (!to) return NextResponse.json({ error: "Your account has no email." }, { status: 400 });
      const res = await sendMarketingEmail({
        to, first_name: firstName, from_name: c.fromName, from_email: c.fromEmail,
        subject: `[TEST] ${email.subject}`, html_body: email.html, unsubscribe_token: makeUnsubscribeToken(to),
      });
      return res.ok ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: res.error ?? "Send failed." }, { status: 502 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed." }, { status: 400 });
  }
}
