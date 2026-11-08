import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { loadWeeklyContext, previewExamples } from "@/lib/private-market/weekly-data";
import { getWeekly, platformPeople, type WeeklyState } from "@/lib/private-market/weekly-store";
import { VERSIONS, versionAudience, type Version } from "@/lib/private-market/weekly-email";
import { factOptions } from "@/lib/private-market/weekly-ai";
import { listWriters } from "@/lib/private-market/weekly-ai-server";
import { WeeklyEmailerClient, type ListOption } from "./WeeklyEmailerClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weekly emailer · Private Market board",
  robots: { index: false, follow: false },
};

async function loadLists(): Promise<ListOption[]> {
  const db = marketingDb();
  const { data } = await db.from("marketing_lists").select("id, name, department, archived").order("name");
  const rows = ((data ?? []) as Array<{ id: string; name: string; department: string | null; archived: boolean | null }>).filter((l) => !l.archived);
  return Promise.all(rows.map(async (l) => {
    const { count } = await db.from("marketing_list_contacts").select("*", { count: "exact", head: true }).eq("list_id", l.id);
    return { id: l.id, name: l.name, department: l.department ?? null, count: count ?? 0 };
  }));
}

export default async function WeeklyEmailerPage() {
  await requireRole(["admin"]);
  const ctx = await loadWeeklyContext();
  const [lists, founders, investors, states, examples, writers] = await Promise.all([
    loadLists(),
    platformPeople("founder").then((p) => p.length).catch(() => 0),
    platformPeople("investor").then((p) => p.length).catch(() => 0),
    Promise.all(VERSIONS.map((a) => getWeekly(a))),
    ctx ? previewExamples(ctx) : Promise.resolve(null),
    listWriters().catch(() => []),
  ]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
  const initial = Object.fromEntries(VERSIONS.map((a, i) => [a, states[i]])) as Record<Version, WeeklyState>;
  return (
    <WeeklyEmailerClient
      initial={initial}
      lists={lists}
      groupCounts={{ founder: founders, investor: investors }}
      market={ctx?.market ?? null}
      examples={examples}
      writers={writers}
      facts={ctx ? (Object.fromEntries(VERSIONS.map((v) => [v, factOptions(ctx.market, versionAudience(v))])) as Record<Version, ReturnType<typeof factOptions>>) : null}
      links={{ appUrl, logoUrl: process.env.EMAIL_LOGO_URL ?? `${appUrl}/email-logo.png`, unsubscribeUrl: "#", preferencesUrl: "#" }}
    />
  );
}
