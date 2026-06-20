import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { dismissTipForToday, setTipsEnabled, loadTipPreference } from "@/lib/tips/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const pref = await loadTipPreference(auth.supabase, auth.profile.id);
  return NextResponse.json({ showTips: pref.showTips });
}

const schema = z.object({
  action: z.enum(["dismiss", "disable", "enable"]),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "dismiss":
      await dismissTipForToday(auth.supabase, auth.profile.id);
      break;
    case "disable":
      await setTipsEnabled(auth.supabase, auth.profile.id, false);
      break;
    case "enable":
      await setTipsEnabled(auth.supabase, auth.profile.id, true);
      break;
  }

  return NextResponse.json({ ok: true });
}
