import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import {
  addPartners, updateEnrollment, removeEnrollment, searchContactsForPartners,
} from "@/lib/marketing/partner-outreach/store";

export const dynamic = "force-dynamic";

const track = z.enum(["advisor", "professional", "angel_group", "accelerator", "bank"]);
const tier = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const rating = z.enum(["strong", "check"]);

const addSchema = z.object({
  partners: z.array(z.object({
    crm_contact_id: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(200),
    firm: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    tier, track: track.optional(), rating: rating.optional(),
    evidence: z.string().trim().max(500).nullable().optional(),
  })).min(1).max(500),
});

const patchSchema = z.object({
  enrollment_id: z.string().uuid(),
  stage: z.enum(["enrolled", "replied", "call_booked", "pilot", "signed", "stopped"]).optional(),
  stop_reason: z.string().trim().max(200).nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  body: z.string().max(8000).nullable().optional(),
  tier: tier.optional(), track: track.optional(), rating: rating.optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
});

async function admin() { return requireRole(["admin"]).catch(() => null); }

// GET ?q=: search Contacts to add as partners.
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await admin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ contacts: await searchContactsForPartners(q) });
}

// POST: add partners (duplicates in this sequence are skipped).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await admin();
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the partner details and try again." }, { status: 400 });
  const { id } = await params;
  try {
    return NextResponse.json(await addPartners(id, parsed.data.partners, profile.id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't add partners." }, { status: 500 });
  }
}

// PATCH: move a partner's stage or edit their Day 1 draft, tier, track or contact details.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await admin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the values and try again." }, { status: 400 });
  const { id } = await params;
  const { enrollment_id, ...patch } = parsed.data;
  try {
    await updateEnrollment(id, enrollment_id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save." }, { status: 500 });
  }
}

// DELETE ?enrollment_id=: remove a partner from this sequence.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await admin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const enrollmentId = req.nextUrl.searchParams.get("enrollment_id");
  if (!enrollmentId) return NextResponse.json({ error: "enrollment_id is required." }, { status: 400 });
  const { id } = await params;
  try {
    await removeEnrollment(id, enrollmentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't remove." }, { status: 500 });
  }
}
