import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { lockAndRelease } from "@/lib/diligence/consent";
import { ActionError } from "@/lib/diligence/admin-actions";

export const dynamic = "force-dynamic";

/** POST — lock & release the sealed engagement to investors. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const { notified } = await lockAndRelease(auth.supabase, id, auth.userId);
    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Release failed." }, { status: 500 });
  }
}
