import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { ListsClient } from "./ListsClient";
import type { MarketingList } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

async function getLists(): Promise<(MarketingList & { contact_count: number })[]> {
  const db = await marketingDb();
  const { data } = await db
    .from("marketing_lists")
    .select("*")
    .order("created_at", { ascending: false });
  const lists = await Promise.all(
    (data ?? []).map(async (list: MarketingList) => {
      const { count } = await db
        .from("marketing_list_contacts")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id);
      return { ...list, contact_count: count ?? 0 };
    })
  );
  return lists;
}

export default async function ListsPage() {
  await requireRole(["admin"]);
  const lists = await getLists();
  return <ListsClient lists={lists} />;
}
