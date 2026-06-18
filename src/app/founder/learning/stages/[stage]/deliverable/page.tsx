import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { DeliverablePageClient } from "./DeliverablePageClient";

export const dynamic = "force-dynamic";

export default async function DeliverablePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) redirect("/auth/sign-in");

  return <DeliverablePageClient params={params} />;
}
