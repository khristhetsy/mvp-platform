import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { getOrCreateAccount, hubLinkedInFor, listCampaigns, listThreads } from "@/lib/linkedin/store";
import { countInvitesToday } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

/** GET: the signed in admin's LinkedIn account, campaigns and inbox threads. Staff only. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    const [campaigns, threads, sentToday, hub] = await Promise.all([listCampaigns(account.id), listThreads(account.id), countInvitesToday(account), hubLinkedInFor(account.label).catch(() => null)]);
    return NextResponse.json({ account, campaigns, threads, sentToday, hub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load LinkedIn." }, { status: 500 });
  }
}
