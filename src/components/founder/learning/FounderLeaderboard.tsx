import type { LearningLeaderboardEntry } from "@/lib/learning/types";
import { useTranslations } from "next-intl";

function displayName(entry: LearningLeaderboardEntry) {
  if (entry.rank <= 3) return entry.companyName;
  const firstName = entry.founderFirstName ?? "Founder";
  const industry = entry.industry ?? "Startup";
  return `${firstName} · ${industry}`;
}

function LeaderboardRow({ entry }: { entry: LearningLeaderboardEntry }) {
  const t = useTranslations("founderCmp");
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        entry.isCurrentCompany
          ? "border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            entry.rank <= 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {entry.rank}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{displayName(entry)}</p>
          {entry.isCurrentCompany ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{t("your_company")}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">{entry.overallPercent}%</span>
        <span>{entry.modulesCompleted} modules</span>
        <span>{entry.badgesEarned} badges</span>
      </div>
    </li>
  );
}

export function FounderLeaderboard({ entries }: { entries: LearningLeaderboardEntry[] }) {
  const t = useTranslations("founderCmp");
  const topTen = entries.slice(0, 10);
  const currentEntry = entries.find((entry) => entry.isCurrentCompany);
  const currentOutsideTopTen = currentEntry && currentEntry.rank > 10;

  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{t("leaderboard")}</p>
        <h2 className="mt-1 text-sm font-semibold text-slate-950">{t("founder_learning_rankings")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("complete_modules_to_appear_on_the_leaderboar")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{t("leaderboard")}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-950">{t("top_founders_by_learning_progress")}</h2>
      <p className="mt-1 text-xs text-slate-500">
        Ranked by overall module completion. Top 3 show company names; others are anonymized.
      </p>

      <ol className="mt-4 space-y-2">
        {topTen.map((entry) => (
          <LeaderboardRow key={entry.companyId} entry={entry} />
        ))}
      </ol>

      {currentOutsideTopTen && currentEntry ? (
        <div className="mt-4 space-y-2">
          <p className="text-center text-xs text-slate-400">···</p>
          <LeaderboardRow entry={currentEntry} />
        </div>
      ) : null}
    </section>
  );
}
