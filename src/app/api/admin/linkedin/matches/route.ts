import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getOrCreateAccount } from "@/lib/linkedin/store";
import { MAX_FILTER_VALUES } from "@/lib/linkedin/limits";
import { isExtensionFresh, matchState, readNetworkFilters } from "@/lib/linkedin/network";
import { getMatchCheck, requestMatchCheck } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const one = z.string().trim().max(80);
/** One text (campaigns saved earlier) or a list of up to 10 values. */
const many = z.union([one, z.array(one).max(MAX_FILTER_VALUES)]).optional();
const schema = z.object({ filters: z.object({ industry: many, locations: many, currentCompany: many, pastCompany: many, school: many, profileLanguage: many, name: one.optional() }).default({}) });

function view(mc: Awaited<ReturnType<typeof getMatchCheck>>, account: { sender_key_set: boolean; worker_last_seen_at: string | null }) {
  const now = new Date();
  return {
    state: matchState(mc, now), key: mc?.key ?? null, total: mc?.total ?? null, detail: mc?.detail ?? null, doneAt: mc?.doneAt ?? null,
    requestedAt: mc?.requestedAt ?? null,
    /** True when the extension asked iCapOS for work in the last few minutes. The form shows "connected" from this. */
    extensionOk: isExtensionFresh(account.worker_last_seen_at, account.sender_key_set, now),
  };
}

/** GET: where the last count stands. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
  return NextResponse.json(view(await getMatchCheck(account.id), account));
}

/** POST: ask your extension to count how many of your 1st connections match these filters. Nothing is saved or sent. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the filters." }, { status: 400 });
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    return NextResponse.json(view(await requestMatchCheck(account.id, readNetworkFilters({ filters: parsed.data.filters })), account), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not ask for the count." }, { status: 500 });
  }
}
