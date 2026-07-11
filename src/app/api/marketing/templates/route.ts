import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createTemplate, getTemplates } from "@/lib/marketing/templates";

// GET — list templates (used by the compose template picker).
export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ templates: await getTemplates() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = await req.json();
    const template = await createTemplate(body, profile.id);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
