import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { exportContactData } from "@/lib/verify/retention";

export const dynamic = "force-dynamic";

// GET /api/prospects/contact-data/[id] — everything held on one person and where it
// came from, as a JSON download (answers an access request).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad contact id." }, { status: 400 });
  try {
    const data = await exportContactData(serviceRoleClientUntyped(), id);
    if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="contact-data-${id}.json"` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed." }, { status: 500 });
  }
}
