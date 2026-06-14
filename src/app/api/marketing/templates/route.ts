import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createTemplate } from "@/lib/marketing/templates";

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
