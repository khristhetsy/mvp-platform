import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";
import {
  getPartnerSequence, listPartnerEnrollments, updatePartnerSequence, activatePartnerSequence, setPartnerSequenceStatus,
} from "@/lib/marketing/partner-outreach/store";

export const dynamic = "force-dynamic";

const configSchema = z.object({
  offer: z.object({
    share_pct: z.number().min(0).max(100).nullable(),
    white_label_price: z.string().trim().max(120).nullable(),
    spv_fee: z.number().min(0).max(10_000_000).nullable(),
    counsel_signed_off: z.boolean(),
  }),
  sender: z.object({
    from_name: z.string().trim().min(1).max(120),
    from_email: z.string().trim().max(200),
    reply_to: z.string().trim().max(200),
  }),
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  department: z.string().trim().max(80).nullable().optional(),
  config: configSchema.optional(),
  action: z.enum(["activate", "pause", "archive", "draft"]).optional(),
});

// GET: the sequence and its partners.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const seq = await getPartnerSequence(id);
  if (!seq) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ sequence: seq, partners: await listPartnerEnrollments(id) });
}

// PATCH: rename, move, save the offer and sender, or change status. Activating
// needs the approver permission (manage_actions) or super admin.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = (await requireRole(["admin"]).catch(() => null)) as (Profile & { is_super_admin?: boolean }) | null;
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  const { id } = await params;
  const { name, department, config, action } = parsed.data;
  try {
    if (name !== undefined || department !== undefined || config !== undefined) {
      await updatePartnerSequence(id, { name, department, config });
    }
    if (action === "activate") {
      const eff = await getEffectivePermissions(createServiceRoleClient(), profile.id, profile);
      if (!eff.isSuperAdmin && !eff.permissions.includes("manage_actions")) {
        return NextResponse.json({ error: "Only an approver can activate. Ask the approver to review it." }, { status: 403 });
      }
      const r = await activatePartnerSequence(id);
      if (r.blockers.length) return NextResponse.json({ error: r.blockers.join(" "), blockers: r.blockers }, { status: 422 });
      return NextResponse.json({ ok: true, started: r.started });
    }
    if (action === "pause") await setPartnerSequenceStatus(id, "paused");
    if (action === "archive") await setPartnerSequenceStatus(id, "archived");
    if (action === "draft") await setPartnerSequenceStatus(id, "draft");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save." }, { status: 500 });
  }
}
