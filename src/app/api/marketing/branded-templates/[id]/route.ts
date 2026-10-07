import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getBrandedTemplate, updateBrandedTemplate } from "@/lib/email/branded-templates";

type Ctx = { params: Promise<{ id: string }> };

// GET — a branded template with its filled-in content, for the editor.
export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const found = await getBrandedTemplate(id);
    if (!found) return NextResponse.json({ error: "Branded template not found." }, { status: 404 });
    return NextResponse.json(found);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// PATCH — save edits; the template's subject and HTML are re-rendered.
export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      slotValues?: Record<string, string>; department?: string | null; name?: string;
    } | null;
    const template = await updateBrandedTemplate(id, {
      slotValues: body?.slotValues ?? {},
      department: body?.department,
      name: body?.name,
    });
    return NextResponse.json(template);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
