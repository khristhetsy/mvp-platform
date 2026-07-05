import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function MarketingAnalyticsPage() {
  await requireRole(["admin"]);
  const supabase = await marketingDb();

  // eslint-disable-next-line react-hooks/purity
  const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  // 30-day funnel counts
  const eventTypes = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "spam_complaint", "unsubscribed"];
  const funnelData: Record<string, number> = {};
  await Promise.all(
    eventTypes.map(async (et) => {
      const { count } = await supabase
        .from("marketing_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", et)
        .gte("occurred_at", since30d);
      funnelData[et] = count ?? 0;
    })
  );

  // Daily opens last 7 days
  const dailyOpens: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    // eslint-disable-next-line react-hooks/purity
    const start = new Date(Date.now() - i * 86400 * 1000);
    // eslint-disable-next-line react-hooks/purity
    const end = new Date(Date.now() - (i - 1) * 86400 * 1000);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("marketing_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "opened")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString());
    dailyOpens.push({
      date: start.toLocaleDateString("en-US", { weekday: "short" }),
      count: count ?? 0,
    });
  }

  const sent        = funnelData["sent"] ?? 0;
  const delivered   = funnelData["delivered"] ?? 0;
  const opened      = funnelData["opened"] ?? 0;
  const clicked     = funnelData["clicked"] ?? 0;
  const replied     = funnelData["replied"] ?? 0;
  const bounced     = funnelData["bounced"] ?? 0;
  const spam        = funnelData["spam_complaint"] ?? 0;
  const unsubscribed = funnelData["unsubscribed"] ?? 0;

  const metrics = {
    sent,
    delivered,
    opened,
    clicked,
    replied,
    bounced,
    unsubscribed,
    openRate:       sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
    clickRate:      sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
    deliverability: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0",
    unsubRate:      sent > 0 ? ((unsubscribed / sent) * 100).toFixed(2) : "0",
    spamRate:       sent > 0 ? ((spam / sent) * 100).toFixed(3) : "0",
    bounceRate:     sent > 0 ? ((bounced / sent) * 100).toFixed(1) : "0",
  };

  // Completed campaigns — for the per-campaign results selector.
  const { data: completedRows } = await supabase
    .from("marketing_campaigns")
    .select("id, name, stat_sent, stat_opened, stat_clicked, created_at")
    .in("status", ["sent", "completed"])
    .order("created_at", { ascending: false })
    .limit(50);
  const completedCampaigns = ((completedRows ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: String(c.id),
    name: (c.name as string) ?? "Campaign",
    sent: (c.stat_sent as number) ?? 0,
    opened: (c.stat_opened as number) ?? 0,
    clicked: (c.stat_clicked as number) ?? 0,
    date: (c.created_at as string) ?? "",
  }));

  // Saved contact lists + campaigns that used them — for the "By contact list" view.
  const { data: listRows } = await supabase
    .from("marketing_lists").select("id, name").eq("archived", false)
    .order("created_at", { ascending: false }).limit(100);
  const lists = await Promise.all(((listRows ?? []) as Array<Record<string, unknown>>).map(async (l) => {
    const { count } = await supabase.from("marketing_list_contacts").select("contact_id", { count: "exact", head: true }).eq("list_id", l.id as string);
    return { id: String(l.id), name: (l.name as string) ?? "List", count: count ?? 0 };
  }));

  const { data: listCampRows } = await supabase
    .from("marketing_campaigns")
    .select("id, name, list_id, stat_sent, stat_opened, stat_clicked")
    .not("list_id", "is", null).limit(300);
  const listCampaigns = ((listCampRows ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: String(c.id), name: (c.name as string) ?? "Campaign", list_id: String(c.list_id),
    sent: (c.stat_sent as number) ?? 0, opened: (c.stat_opened as number) ?? 0, clicked: (c.stat_clicked as number) ?? 0,
  }));

  return <AnalyticsClient metrics={metrics} dailyOpens={dailyOpens} completedCampaigns={completedCampaigns} lists={lists} listCampaigns={listCampaigns} />;
}
