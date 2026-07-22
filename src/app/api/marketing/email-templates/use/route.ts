import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createCopyFromMaster } from "@/lib/email/masters-queries";

// "Use template" (build spec §5): create a fresh copy from a master and return
// its id so the client can redirect into the editor. Never mutates the master.
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = (await req.json().catch(() => null)) as { masterId?: string } | null;
    if (!body?.masterId) {
      return NextResponse.json({ error: "masterId is required." }, { status: 400 });
    }
    const copy = await createCopyFromMaster(body.masterId, profile.id);
    return NextResponse.json({ copyId: copy.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create template copy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
