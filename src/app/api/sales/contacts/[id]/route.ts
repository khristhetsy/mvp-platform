import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile, appendContactNote, updateContact } from "@/lib/sales/contacts";
import { getSalesScope } from "@/lib/sales/scope";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  lead_status: z.string().max(40).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  owner: z.string().max(120).nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  assignee_ids: z.array(z.string().uuid()).max(50).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  phone2: z.string().max(60).nullable().optional(),
  lead_source: z.string().max(120).nullable().optional(),
  membership: z.string().max(120).nullable().optional(),
  job_position: z.string().max(120).nullable().optional(),
  language: z.string().max(60).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  street2: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(120).nullable().optional(),
  zip: z.string().max(40).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
});

// PATCH /api/sales/contacts/[id] — edit user-owned contact fields.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const scope = await getSalesScope(profile);
  // Non-admins may only edit contacts they own or are assigned to.
  const update = { ...parsed.data };
  if (!scope.isManager) {
    const existing = await getContactProfile(id);
    const c = existing?.contact;
    if (!c || (c.owner_id !== scope.ownerId && !c.assignee_ids.includes(scope.ownerId ?? ""))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Lead owner and Lead assign (assignees) can only be changed by a super admin.
  if (!isSuperAdmin(profile)) {
    delete update.owner_id;
    delete update.assignee_ids;
  }
  try {
    await updateContact(id, update, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

// GET /api/sales/contacts/[id] — full profile + linked opportunities.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const data = await getContactProfile(id);
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const scope = await getSalesScope(profile);
  if (!scope.isManager && data.contact.owner_id !== scope.ownerId && !data.contact.assignee_ids.includes(scope.ownerId ?? "")) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(data);
}

const noteSchema = z.object({ note: z.string().min(1).max(2000) });

// POST /api/sales/contacts/[id] — append an internal note.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = noteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A note is required." }, { status: 400 });
  const scope = await getSalesScope(profile);
  if (!scope.isManager) {
    const existing = await getContactProfile(id);
    const c = existing?.contact;
    if (!c || (c.owner_id !== scope.ownerId && !c.assignee_ids.includes(scope.ownerId ?? ""))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    await appendContactNote(id, parsed.data.note, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
