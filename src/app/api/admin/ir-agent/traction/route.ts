import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { buildTraction, TRACTION_PERIODS, type AccountRow, type PostRow, type TractionAgent, type TractionConversation, type TractionPeriod, type TractionView, type VariantRow } from "@/lib/ir-agent/traction";

export const dynamic = "force-dynamic";

/** Rows read per request. Above this the answer says so instead of looking complete. */
const ROW_CAP = 20_000;

/** Agent traction for the Traction tab: conversations per agent, department and source, with change against the previous period. */
export async function GET(req: Request) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = (TRACTION_PERIODS as readonly number[]).includes(asked) ? (asked as TractionPeriod) : 30;
  const since = new Date(Date.now() - days * 2 * 86_400_000).toISOString();

  const db = serviceRoleClientUntyped();
  const [agentRes, convRes, viewRes, postRes] = await Promise.all([
    db.from("ir_agents").select("id, display_name, company_name, company_slug, ending, agent_type, image_url, archived_at").limit(500),
    db.from("ir_agent_conversations").select("agent_id, source, created_at, booked_at").gte("created_at", since).order("created_at", { ascending: false }).limit(ROW_CAP + 1),
    // Before the ir_agent_views migration is run this errors, and views then show as not recorded.
    db.from("ir_agent_views").select("agent_id, source, created_at").gte("created_at", since).limit(ROW_CAP + 1),
    // Posts that carry a link: the agent link sits in the post link or the first comment.
    db.from("social_posts").select("id, title, body, link_url, comment_text, status, scheduled_at, created_at").or("link_url.not.is.null,comment_text.not.is.null").order("created_at", { ascending: false }).limit(2000),
  ]);
  if (agentRes.error || convRes.error) return NextResponse.json({ error: "Could not load agent traction." }, { status: 500 });

  const agents = ((agentRes.data ?? []) as Array<{ id: string; display_name: string; company_name: string; company_slug: string; ending: string; agent_type: string | null; image_url: string | null; archived_at: string | null }>)
    .filter((a) => !a.archived_at)
    .map((a): TractionAgent => ({ id: a.id, name: a.display_name, companyName: a.company_name, agentType: a.agent_type, imageUrl: a.image_url, companySlug: a.company_slug, ending: a.ending }));
  const rows = (convRes.data ?? []) as TractionConversation[];
  const views = viewRes.error ? null : ((viewRes.data ?? []) as TractionView[]);
  const truncated = rows.length > ROW_CAP || (views?.length ?? 0) > ROW_CAP;

  // Keep only posts that carry an agent link, so the variant lookup stays small.
  const needles = agents.filter((a) => a.companySlug && a.ending).map((a) => `/${a.companySlug}/${a.ending}`.toLowerCase());
  const posts = ((postRes.error ? [] : (postRes.data ?? [])) as PostRow[]).filter((p) => needles.some((n) => `${p.link_url ?? ""} ${p.comment_text ?? ""}`.toLowerCase().includes(n)));
  const postIds = posts.map((p) => p.id);
  const varRes = postIds.length ? await db.from("social_variants").select("post_id, account_id, status, url, published_at, comment_text").in("post_id", postIds) : { data: [], error: null };
  const variants = (varRes.error ? [] : (varRes.data ?? [])) as VariantRow[];
  const accIds = [...new Set(variants.map((v) => v.account_id))];
  const accRes = accIds.length ? await db.from("social_accounts").select("id, platform").in("id", accIds) : { data: [], error: null };
  const accounts = (accRes.error ? [] : (accRes.data ?? [])) as AccountRow[];

  return NextResponse.json({ traction: buildTraction(agents, rows.slice(0, ROW_CAP), days, new Date(), { views: views ? views.slice(0, ROW_CAP) : null, posts, variants, accounts }), truncated, generatedAt: new Date().toISOString() });
}
