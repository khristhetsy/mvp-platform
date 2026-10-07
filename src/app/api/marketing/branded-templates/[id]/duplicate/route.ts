import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { duplicateBrandedTemplate } from "@/lib/email/branded-templates";

// POST — duplicate a branded template with its own content (saved as a draft).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const { id } = await params;
    return NextResponse.json(await duplicateBrandedTemplate(id, profile.id), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
