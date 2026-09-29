import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  REACH_OUT_TABS,
  cancelScheduledReachOut,
  getScheduledReachOut,
  listReachOutsForJobsPage,
  sendScheduledReachOutNow,
  type ReachOutTab,
} from "@/lib/founder-outreach/scheduled-reach-outs";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/scheduled-jobs/reach-outs?tab=scheduled|sent|failed|canceled
 *   every company's Reach out emails in that tab, with counts per tab.
 * GET ?id=<uuid>  one email in full.
 * System access only, like the rest of Scheduled jobs.
 */
export async function GET(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const email = await getScheduledReachOut(id);
    return email ? NextResponse.json({ email }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const tab = (params.get("tab") ?? "scheduled") as ReachOutTab;
  if (!REACH_OUT_TABS.includes(tab)) return NextResponse.json({ error: "Unknown tab." }, { status: 400 });
  return NextResponse.json(await listReachOutsForJobsPage(tab));
}

const actionSchema = z.object({ action: z.enum(["send-now", "cancel"]), id: z.string().uuid() });

/** POST { action: "send-now" | "cancel", id }. Send now also resends a failed email. */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.action === "cancel") {
    const ok = await cancelScheduledReachOut(null, parsed.data.id);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "This email has already been sent or canceled." }, { status: 409 });
  }
  const r = await sendScheduledReachOutNow(null, parsed.data.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
