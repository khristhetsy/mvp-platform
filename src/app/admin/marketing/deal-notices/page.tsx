import { requireRole } from "@/lib/supabase/auth";
import { loadDealNoticeStats } from "@/lib/listing/deal-notice-admin";
import { DealNoticesClient } from "./DealNoticesClient";

export const dynamic = "force-dynamic";

export default async function DealNoticesPage() {
  await requireRole(["admin", "analyst"]);
  const stats = await loadDealNoticeStats().catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) }));
  return <DealNoticesClient initial={"error" in stats ? null : stats} loadError={"error" in stats ? stats.error : null} />;
}
