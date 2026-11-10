import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getOrCreateAccount } from "@/lib/linkedin/store";
import { matchState, readNetworkFilters } from "@/lib/linkedin/network";
import { getMatchCheck, requestMatchCheck } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const text = z.string().trim().max(80).optional();
const schema = z.object({ filters: z.object({ industry: text, locations: text, currentCompany: text, pastCompany: text, school: text, profileLanguage: text, name: text }).default({}) });

function view(mc: Awaited<ReturnType<typeof getMatchCheck>>) {
  return { state: matchState(mc, new Date()), key: mc?.key ?? null, total: mc?.total ?? null, detail: mc?.detail ?? null, doneAt: mc?.doneAt ?? null };
}

/** GET: where the last count stands. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
  return NextResponse.json(view(await getMatchCheck(account.id)));
}

/** POST: ask your extension to count how many of your 1st connections match these filters. Nothing is saved or sent. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the filters." }, { status: 400 });
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    return NextResponse.json(view(await requestMatchCheck(account.id, readNetworkFilters({ filters: parsed.data.filters }))), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not ask for the count." }, { status: 500 });
  }
}
