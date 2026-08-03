import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

// Founders who have NOT yet reached Match (journey stage "deploy"+). These are
// the accounts stalling in the 2→3 gap — the operator's manual-unstick queue.
const PRE_MATCH_STAGES = new Set(["initialize", "qualify"]);

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function stageLabel(stage: string): string {
  if (stage === "qualify") return "Ready";
  if (stage === "initialize") return "Onboarding";
  return stage;
}

export default async function AdminStuckFoundersPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const admin = createServiceRoleClient();

  const { data: companiesData } = await admin
    .from("companies")
    .select("id, founder_id, company_name, industry, updated_at, created_at");
  const companies = (companiesData ?? []) as Row[];

  const founderIds = [...new Set(companies.map((c) => c.founder_id as string).filter(Boolean))];
  const { data: profilesData } = founderIds.length
    ? await admin.from("profiles").select("id, full_name, email, journey_stage, updated_at").in("id", founderIds)
    : { data: [] as Row[] };
  const profileById = new Map<string, Row>();
  for (const p of (profilesData ?? []) as Row[]) profileById.set(p.id as string, p);

  const { data: scoresData } = await admin
    .from("company_readiness_scores")
    .select("company_id, effective_score, total_score, outreach_unlocked, created_at")
    .order("created_at", { ascending: false });
  const scoreByCompany = new Map<string, Row>();
  for (const s of (scoresData ?? []) as Row[]) {
    const cid = s.company_id as string;
    if (!scoreByCompany.has(cid)) scoreByCompany.set(cid, s);
  }

  type StuckRow = {
    companyId: string;
    companyName: string;
    industry: string | null;
    founderName: string;
    stage: string;
    idleDays: number | null;
    score: number | null;
    fundable: boolean;
    signedUp: string | null;
  };

  const rows: StuckRow[] = [];
  for (const c of companies) {
    const founder = c.founder_id ? profileById.get(c.founder_id as string) : null;
    const stage = String((founder?.journey_stage as string | null) ?? "initialize");
    if (!PRE_MATCH_STAGES.has(stage)) continue;
    const score = scoreByCompany.get(c.id as string) ?? null;
    const lastActive =
      [c.updated_at as string | null, (founder?.updated_at as string | null) ?? null]
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null;
    rows.push({
      companyId: String(c.id),
      companyName: String(c.company_name ?? "Untitled"),
      industry: (c.industry as string | null) ?? null,
      founderName: String((founder?.full_name as string | null) ?? (founder?.email as string | null) ?? "—"),
      stage,
      idleDays: daysSince(lastActive as string | null),
      score: score ? Number((score.effective_score ?? score.total_score) as number) : null,
      fundable: Boolean(score?.outreach_unlocked),
      signedUp: (c.created_at as string | null) ?? null,
    });
  }
  rows.sort((a, b) => (b.idleDays ?? -1) - (a.idleDays ?? -1));

  const total = rows.length;
  const idle7 = rows.filter((r) => (r.idleDays ?? 0) >= 7).length;
  const notFundable = rows.filter((r) => !r.fundable).length;

  const metric = (label: string, value: number | string, tone = "text-slate-950") => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Stuck founders</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Founders who haven&apos;t yet reached Match — the 2→3 gap. Sorted by how long they&apos;ve been idle so
          your team can reach out and unstick them. Read-only; open a founder to act.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metric("Pre-Match founders", total)}
        {metric("Idle 7+ days", idle7, idle7 > 0 ? "text-amber-600" : "text-slate-950")}
        {metric("Not yet fundable", notFundable, notFundable > 0 ? "text-rose-600" : "text-slate-950")}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Founder</th>
              <th className="px-4 py-2.5">Stage</th>
              <th className="px-4 py-2.5">Readiness</th>
              <th className="px-4 py-2.5">Idle</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No founders are stuck before Match right now.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.companyId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950">{r.companyName}</p>
                    {r.industry ? <p className="text-xs text-slate-500">{r.industry}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.founderName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {stageLabel(r.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.score !== null ? (
                      <span className="text-slate-700">
                        {r.score}%
                        {!r.fundable ? (
                          <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">
                            not fundable
                          </span>
                        ) : (
                          <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            fundable
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">not scored</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={(r.idleDays ?? 0) >= 7 ? "font-medium text-amber-600" : "text-slate-600"}>
                      {r.idleDays === null ? "—" : r.idleDays === 0 ? "today" : `${r.idleDays}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/companies/${r.companyId}`}
                      className="text-sm font-medium text-[var(--blue)] hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
