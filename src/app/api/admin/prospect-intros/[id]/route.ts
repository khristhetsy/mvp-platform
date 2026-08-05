import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { setProspectIntroStatus, type ProspectIntroStatus } from "@/lib/matching/prospect-intros";

export const dynamic = "force-dynamic";

const VALID: ProspectIntroStatus[] = ["new", "contacted", "dismissed"];

// POST /api/admin/prospect-intros/[id] — update a brokered intro's status. Staff only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status as ProspectIntroStatus | undefined;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: "status must be new, contacted, or dismissed." }, { status: 400 });
  }

  const ok = await setProspectIntroStatus(id, status, auth.profile.id);
  if (!ok) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
