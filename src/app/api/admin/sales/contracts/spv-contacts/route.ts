import { NextResponse } from "next/server";
import { requireContractsApi } from "@/lib/contracts/access";

export const dynamic = "force-dynamic";

/** GET ?q= — contacts tagged SPV that the caller can see (the only contacts contracts can go to). */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireContractsApi();
  if ("error" in auth) return auth.error;
  const { actor } = auth;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  let query = actor.db
    .from("crm_contacts")
    .select("id, name, email, company, tags")
    .overlaps("tags", ["SPV", "spv", "Spv"])
    .order("name")
    .limit(50);
  if (!actor.scope.canSeeAllContacts) query = query.contains("assignee_ids", [actor.userId]);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}
