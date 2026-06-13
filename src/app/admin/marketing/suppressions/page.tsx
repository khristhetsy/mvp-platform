import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { SuppressionsClient } from "./SuppressionsClient";

export const dynamic = "force-dynamic";

async function getSuppressions() {
  const db = await marketingDb();
  const { data } = await db
    .from("marketing_unsubscribes")
    .select("email,reason,unsubscribed_at")
    .order("unsubscribed_at", { ascending: false });
  return (data ?? []) as { email: string; reason: string | null; unsubscribed_at: string }[];
}

export default async function SuppressionsPage() {
  await requireRole(["admin"]);
  const suppressions = await getSuppressions();
  return <SuppressionsClient suppressions={suppressions} />;
}
