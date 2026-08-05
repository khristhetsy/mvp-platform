import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getFounderStageMenuCatalog } from "@/lib/workspace-nav";
import { getFounderStageMenuHidden, setFounderStageMenuHidden } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

// GET — the stage/menu catalog + which hrefs are currently hidden. Staff only.
export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const [catalog, hidden] = await Promise.all([
    Promise.resolve(getFounderStageMenuCatalog()),
    getFounderStageMenuHidden(),
  ]);
  return NextResponse.json({ catalog, hidden });
}

// POST — save the hidden hrefs. Body: { hidden: string[] }. Staff only.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
  const hidden = Array.isArray(body?.hidden) ? body!.hidden.filter((h): h is string => typeof h === "string") : null;
  if (!hidden) return NextResponse.json({ error: "hidden (string[]) is required." }, { status: 400 });

  // Guard: never let an admin hide a whole stage's items — a stage must keep ≥1.
  const catalog = getFounderStageMenuCatalog();
  const hiddenSet = new Set(hidden);
  for (const group of catalog) {
    const visible = group.items.filter((i) => !hiddenSet.has(i.href));
    if (group.items.length > 0 && visible.length === 0) {
      return NextResponse.json(
        { error: `"${group.stage}" must keep at least one menu item visible.` },
        { status: 400 },
      );
    }
  }

  const ok = await setFounderStageMenuHidden(hidden, auth.profile.id);
  if (!ok) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
