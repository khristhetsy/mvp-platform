import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { buildInvestorCards, emptiedStage } from "@/lib/feature-controls/by-stage";
import { getInvestorStageMenuHidden, setInvestorStageMenuHidden } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

// GET — which investor menu hrefs are currently hidden. Staff only.
export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ hidden: await getInvestorStageMenuHidden() });
}

// POST — save the hidden hrefs. Body: { hidden: string[] }. Staff only.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
  const hidden = Array.isArray(body?.hidden) ? body!.hidden.filter((h): h is string => typeof h === "string") : null;
  if (!hidden) return NextResponse.json({ error: "hidden (string[]) is required." }, { status: 400 });

  // Guard: a stage must keep at least one menu item visible.
  const emptied = emptiedStage(buildInvestorCards(), new Set(hidden));
  if (emptied) {
    return NextResponse.json({ error: `"${emptied}" must keep at least one menu item visible.` }, { status: 400 });
  }

  const ok = await setInvestorStageMenuHidden(hidden, auth.profile.id);
  if (!ok) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
