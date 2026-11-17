import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { CloudSenderError, cloudSenderConfig, listAccounts, listCampaigns } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";

/** GET: whether the cloud sender is set up and reachable, with its accounts and campaigns. Staff only. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const cfg = cloudSenderConfig();
  if (!cfg) return NextResponse.json({ configured: false, connected: false, accounts: [], campaigns: [], error: null });
  try {
    const [accounts, campaigns] = await Promise.all([listAccounts(cfg), listCampaigns(cfg)]);
    return NextResponse.json({ configured: true, connected: true, accounts, campaigns, error: null });
  } catch (e) {
    const error = e instanceof CloudSenderError ? e.message : "Could not load the sender.";
    return NextResponse.json({ configured: true, connected: false, accounts: [], campaigns: [], error });
  }
}
