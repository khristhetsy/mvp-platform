import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { getSequences } from "@/lib/marketing/sequences";
import type { MarketingContact } from "@/lib/marketing/types";
import { MarketingContactProfile } from "./MarketingContactProfile";

export const dynamic = "force-dynamic";

export default async function MarketingContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const db = marketingDb();

  const { data: contact } = await db
    .from("marketing_contacts")
    .select("id,email,first_name,last_name,company,title,source,tags,created_at")
    .eq("id", id)
    .maybeSingle();
  if (!contact) notFound();

  const [{ data: memberships }, { data: allLists }, sequences, { data: unsub }] = await Promise.all([
    db.from("marketing_list_contacts").select("list_id, marketing_lists(id,name)").eq("contact_id", id),
    db.from("marketing_lists").select("id,name").order("created_at", { ascending: false }),
    getSequences().catch(() => []),
    db.from("marketing_unsubscribes").select("email,reason,unsubscribed_at").eq("email", contact.email).maybeSingle(),
  ]);

  type Embed = { marketing_lists: { id: string; name: string } | { id: string; name: string }[] | null };
  const memberLists = ((memberships ?? []) as Embed[])
    .map((m) => (Array.isArray(m.marketing_lists) ? m.marketing_lists[0] ?? null : m.marketing_lists))
    .filter((l): l is { id: string; name: string } => Boolean(l));

  return (
    <MarketingContactProfile
      contact={contact as MarketingContact}
      memberLists={memberLists}
      allLists={(allLists ?? []) as { id: string; name: string }[]}
      sequences={(sequences ?? []).filter((s) => s.status === "active" || s.status === "draft").map((s) => ({ id: s.id, name: s.name }))}
      unsubscribed={unsub ? { unsubscribed_at: (unsub as { unsubscribed_at: string }).unsubscribed_at } : null}
    />
  );
}
