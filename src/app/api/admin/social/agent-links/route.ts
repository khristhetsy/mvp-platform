/**
 * Agent links for the Social Hub composer and the campaign wizard, staff only:
 * Johnny (iCFO's own IR agent) and every live founder agent, each with its tracked
 * link. The link is tagged for LinkedIn unless ?channel= names another channel.
 *   GET → { links: [{ key, label, url }] }
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { CHANNELS, trackedUrl, type Channel } from "@/lib/ir-agent/slug";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("channel");
  const channel: Channel = CHANNELS.find((c) => c === asked) ?? "linkedin";
  const staff = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await serviceRoleClientUntyped()
    .from("ir_agents")
    .select("company_slug, ending, company_name, display_name")
    .eq("status", "live")
    .order("company_name");
  const founders = ((data ?? []) as Array<{ company_slug: string; ending: string; company_name: string; display_name: string }>).map((a) => ({
    key: a.company_slug,
    label: `${a.company_name} · ${a.display_name}`,
    url: trackedUrl(a.company_slug, a.ending, channel),
  }));
  return NextResponse.json({
    links: [{ key: "johnny", label: "Johnny, iCFO Investor Relations", url: `https://icapos.com/johnny?src=${channel}` }, ...founders],
  });
}
