import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { reorderLineup } from "@/lib/icfo-events/spotlight/service";

export const dynamic = "force-dynamic";

/** Save the Spotlight lineup order for one block (staff). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { presenterIds?: unknown };
  const ids = Array.isArray(body.presenterIds) ? body.presenterIds.filter((v): v is string => typeof v === "string").slice(0, 200) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });
  await reorderLineup(id, ids);
  return NextResponse.json({ ok: true });
}
