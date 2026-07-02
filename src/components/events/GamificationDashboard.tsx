import type { LeaderboardEntry, MemberStats } from "@/lib/icfo-events/gamification";
import { useTranslations } from "next-intl";
import type { MissionProgress } from "@/lib/icfo-events/missions";

const BADGE_BG = ["#E6F1FB", "#E1F5EE", "#FAEEDA", "#EAF3DE", "#EEEDFE"];
const BADGE_FG = ["#185FA5", "#0F6E56", "#854F0B", "#3B6D11", "#3C3489"];

export function GamificationDashboard({
  stats,
  rank,
  missions,
  leaderboard,
  meId,
}: {
  stats: MemberStats;
  rank: number | null;
  missions: MissionProgress[];
  leaderboard: LeaderboardEntry[];
  meId: string;
}) {
  const t = useTranslations("eventsCmp");
  return (
    <div className="p-4 sm:p-5">
      <h1 className="text-xl font-semibold text-[var(--navy)]">{t("gamification")}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Points for real participation — missions, badges, leaderboard. Rewards are status, not prizes.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4 text-white" style={{ background: "#0c2340" }}>
          <p className="text-xs" style={{ color: "#aeb8c7" }}>{t("engagement_points")}</p>
          <p className="mt-1 text-2xl font-semibold">{stats.points.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <p className="text-xs text-[var(--text-secondary)]">{t("rank")}</p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: "#3B6D11" }}>{rank ? `#${rank}` : "—"}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <p className="text-xs text-[var(--text-secondary)]">{t("badges")}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">{stats.badges.length}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-sm font-medium text-[var(--navy)]">{t("badges_earned")}</h2>
        {stats.badges.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t("no_badges_yet_join_a_session_or_connect_with")}</p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {stats.badges.map((b, i) => (
              <span
                key={b}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: BADGE_BG[i % BADGE_BG.length], color: BADGE_FG[i % BADGE_FG.length] }}
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-medium text-[var(--navy)]">{t("active_missions")}</h2>
          {missions.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("no_active_missions_right_now")}</p>
          ) : (
            <div className="mt-3 space-y-3.5">
              {missions.map((m) => {
                const total = m.requiredActions.length || 1;
                const done = Math.min(m.completedActions.length, total);
                const pct = Math.round((done / total) * 100);
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--navy)]">{m.title}</span>
                      <span className="text-xs text-[var(--text-muted)]">{done} / {total} · +{m.bonusPoints}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full" style={{ background: "#E1F5EE" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "#1D9E75" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] text-[var(--text-muted)]">{t("rewards_are_status_not_prizes_top_contributo")}</p>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <h2 className="text-sm font-medium text-[var(--navy)]">{t("leaderboard")}</h2>
          {leaderboard.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("no_points_awarded_yet")}</p>
          ) : (
            <div className="mt-2.5 space-y-0.5">
              {leaderboard.map((e) => {
                const isMe = e.profileId === meId;
                return (
                  <div
                    key={e.profileId}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm"
                    style={isMe ? { background: "#E6F1FB" } : undefined}
                  >
                    <span style={isMe ? { color: "#0C447C", fontWeight: 500 } : undefined}>
                      {e.rank}&nbsp;&nbsp;{isMe ? "You" : e.displayName}
                    </span>
                    <span style={isMe ? { color: "#0C447C", fontWeight: 500 } : { color: "var(--text-secondary)" }}>
                      {e.points.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
