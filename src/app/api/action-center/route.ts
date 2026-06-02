import { NextResponse } from "next/server";
import { loadActionCenter } from "@/lib/actions/action-center";
import { parseActionCenterFilters } from "@/lib/actions/filters";
import { requireApiProfile } from "@/lib/api/auth";

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const filters = parseActionCenterFilters(url.searchParams);
  const sync = url.searchParams.get("sync") !== "false";

  try {
    const result = await loadActionCenter({
      profile: auth.profile,
      supabase: auth.supabase,
      filters,
      sync,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Unable to load action center.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
