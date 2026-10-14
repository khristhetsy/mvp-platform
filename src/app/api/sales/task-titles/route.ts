import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

// GET /api/sales/task-titles — the ready made titles offered in the Task title field.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data, error } = await db().from("sales_task_title_options").select("id, title, task_type").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ options: [] });
  return NextResponse.json({ options: data ?? [] });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  taskType: z.string().trim().max(40).optional(),
});

// POST /api/sales/task-titles — save a new option for the whole team.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  const title = parsed.data.title;
  const existing = await db().from("sales_task_title_options").select("id").ilike("title", title.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (existing.data) return NextResponse.json({ option: existing.data, existed: true });
  const { data, error } = await db().from("sales_task_title_options").insert({ title, task_type: parsed.data.taskType || "Call", sort_order: 100, created_by: profile.id }).select("id, title, task_type").single();
  if (error) return NextResponse.json({ error: "Couldn’t save the option." }, { status: 500 });
  return NextResponse.json({ option: data });
}
