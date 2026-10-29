/**
 * Meetings tab on an IR task: the contacts linked to the week (Odoo's Meetings list).
 *   GET                  → { contacts: [{ id, name, company, membership, createdBy, phone, email, createdOn, activity, city, country }] }
 *   POST   { contactId } → link an existing contact (idempotent)
 *   DELETE { contactId } → unlink (the contact itself is kept)
 * Links live in ir_task_meeting_contacts, not ir_matches, so Matching counts are unaffected.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, getTask } from "@/lib/ir/db";
import { loadNextActivities } from "@/lib/sales/contact-next-activity";

export const dynamic = "force-dynamic";

const blank = (v: unknown): string | null => { const s = typeof v === "string" ? v.trim() : ""; return s && s.toLowerCase() !== "false" ? s : null; };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const { data: links, error } = await db().from("ir_task_meeting_contacts").select("contact_id, created_at").eq("task_id", id).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = ((links ?? []) as Array<{ contact_id: string }>).map((l) => l.contact_id);
    if (!ids.length) return NextResponse.json({ contacts: [] });
    const { data: cs, error: e2 } = await db().from("crm_contacts").select("id, name, email, company, phone, country, contact_type, created_on, synced_at, owner_id, overrides, raw").in("id", ids);
    if (e2) throw new Error(e2.message);
    const rows = (cs ?? []) as Array<{ id: string; name: string | null; email: string | null; company: string | null; phone: string | null; country: string | null; contact_type: string | null; created_on: string | null; synced_at: string | null; owner_id: string | null; overrides: Record<string, unknown> | null; raw: Record<string, unknown> | null }>;
    const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: ps } = await db().from("profiles").select("id, full_name, email").in("id", ownerIds);
      for (const p of (ps ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name ?? p.email ?? "Staff");
    }
    const next = await loadNextActivities(db(), ids).catch(() => new Map());
    const byId = new Map(rows.map((r) => [r.id, r]));
    const contacts = ids.filter((cid) => byId.has(cid)).map((cid) => {
      const r = byId.get(cid)!; const raw = r.raw ?? {}; const ov = r.overrides ?? {};
      return {
        id: r.id, name: r.name ?? r.email ?? "Contact", company: r.company ?? "",
        membership: r.contact_type ? r.contact_type[0].toUpperCase() + r.contact_type.slice(1) : "",
        createdBy: r.owner_id ? names.get(r.owner_id) ?? "" : "",
        phone: blank(r.phone) ?? blank(raw.phone) ?? blank(raw.mobile) ?? "", email: r.email ?? "",
        createdOn: r.created_on ?? (r.synced_at ? String(r.synced_at).slice(0, 10) : ""),
        activity: next.get(r.id) ?? null, city: blank(ov.city) ?? blank(raw.city) ?? "", country: r.country ?? "",
      };
    });
    return NextResponse.json({ contacts });
  } catch (e) { return failed(e, "Couldn't load the meetings."); }
}

const body = z.object({ contactId: z.string().uuid() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const p = body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick a contact." }, { status: 400 });
  try {
    if (!(await getTask(id))) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const { error } = await db().from("ir_task_meeting_contacts").upsert({ task_id: id, contact_id: p.data.contactId, created_by: me.id }, { onConflict: "task_id,contact_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't add the contact."); }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const p = body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick a contact." }, { status: 400 });
  try {
    const { error } = await db().from("ir_task_meeting_contacts").delete().eq("task_id", id).eq("contact_id", p.data.contactId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't remove the contact."); }
}
