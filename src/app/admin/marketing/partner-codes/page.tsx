import { requireRole } from "@/lib/supabase/auth";
import { listPartnerCodes } from "@/lib/listing/deal-notice-admin";
import { PartnerCodesClient } from "./PartnerCodesClient";

export const dynamic = "force-dynamic";

export default async function PartnerCodesPage() {
  await requireRole(["admin", "analyst"]);
  const codes = await listPartnerCodes().catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) }));
  return <PartnerCodesClient initial={"error" in codes ? [] : codes} loadError={"error" in codes ? codes.error : null} />;
}
