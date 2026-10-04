import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api/super-admin";
import { normalizeAdminHome } from "@/lib/settings/admin-home-shape";
import { getAdminHomeSettings, setAdminHomeSettings } from "@/lib/settings/admin-home";

export const dynamic = "force-dynamic";

/** Company-wide admin Home settings. Read by every admin through /api/feature-controls; only a super admin can change them. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireSuperAdminApi();
  if (auth.error) return auth.error;

  let body: unknown = null;
  try { body = await request.json(); } catch { /* handled below */ }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the settings as JSON." }, { status: 400 });

  const current = await getAdminHomeSettings();
  const next = normalizeAdminHome({ ...current, ...(body as object) });
  const ok = await setAdminHomeSettings(next, auth.userId);
  if (!ok) return NextResponse.json({ error: "Couldn't save the settings. Try again." }, { status: 500 });
  return NextResponse.json({ adminHome: next });
}
