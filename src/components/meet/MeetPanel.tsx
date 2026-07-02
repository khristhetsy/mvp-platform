"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Video, RefreshCw, Phone, User, Users, ExternalLink, Calendar } from "lucide-react";

type Guest = { email: string; displayName: string | null; responseStatus: string | null };
type Meeting = {
  id: string;
  title: string;
  start: string;
  end: string;
  meetUrl: string;
  phone: string | null;
  pin: string | null;
  organizer: { email: string | null; displayName: string | null } | null;
  guests: Guest[];
};

function timeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)} – ${t(e)}`;
}
function shortTime(start: string, end: string): string {
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${t(new Date(start))} – ${t(new Date(end))}`;
}
function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}
function rsvpCounts(guests: Guest[]): string {
  const yes = guests.filter((g) => g.responseStatus === "accepted").length;
  const awaiting = guests.filter((g) => g.responseStatus === "needsAction" || !g.responseStatus).length;
  const parts = [`${guests.length} guest${guests.length === 1 ? "" : "s"}`];
  if (yes) parts.push(`${yes} yes`);
  if (awaiting) parts.push(`${awaiting} awaiting`);
  return parts.join(" · ");
}

const AVATAR_BG = ["#CECBF6", "#9FE1CB", "#F4C0D1", "#FAC775", "#B5D4F4", "#F0997B"];
const AVATAR_FG = ["#3C3489", "#0F6E56", "#72243E", "#854F0B", "#0C447C", "#712B13"];

export function MeetPanel() {
  const t = useTranslations("sharedCmp");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/meet");
      const data = await res.json();
      setConnected(data.connected !== false);
      const list: Meeting[] = data.meetings ?? [];
      setMeetings(list);
      setActiveId((cur) => cur && list.some((m) => m.id === cur) ? cur : (list[0]?.id ?? null));
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const active = meetings.find((m) => m.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <Video className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Meet
        </h1>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error ? <p className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C]">{error}</p> : null}

      {!connected ? (
        <div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] px-4 py-6 text-center">
          <p className="text-sm font-medium text-[#0C447C]">{t("connect_google_to_see_your_meet_meetings")}</p>
          <a href="/api/integrations/google/connect?returnTo=/admin/meet" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#234f86]">
            <ExternalLink className="h-4 w-4" /> Connect Google
          </a>
        </div>
      ) : loading ? (
        <p className="px-1 py-6 text-sm text-slate-400">{t("loading_meetings")}</p>
      ) : meetings.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No upcoming meetings with a Meet link in the next 14 days.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
            <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("upcoming")}</p>
            <nav className="pb-2">
              {meetings.map((m) => {
                const on = m.id === activeId;
                return (
                  <button key={m.id} type="button" onClick={() => setActiveId(m.id)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${on ? "bg-[#E6F1FB]" : "hover:bg-slate-50"}`}>
                    <span className={`text-sm ${on ? "font-medium text-[#0C447C]" : "text-slate-800"}`}>{m.title}</span>
                    <span className={`text-xs ${on ? "text-[#185FA5]" : "text-slate-400"}`}>{shortTime(m.start, m.end)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {active ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-950">{active.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500"><Calendar className="h-3.5 w-3.5" /> {timeRange(active.start, active.end)}</p>
                </div>
                <a href={active.meetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C447C]">
                  <Video className="h-4 w-4" /> Join now
                </a>
              </div>

              <div className="my-4 border-t border-slate-100" />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_180px]">
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("joining_info")}</p>
                    <a href={active.meetUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-[#185FA5] underline">{active.meetUrl.replace(/^https?:\/\//, "")}</a>
                    {active.phone ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" /> {active.phone}{active.pin ? ` · PIN ${active.pin}` : ""}</p>
                    ) : null}
                  </div>
                  {active.organizer ? (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("organizer")}</p>
                      <p className="flex items-center gap-1.5 text-sm text-slate-700"><User className="h-3.5 w-3.5 text-slate-400" /> {active.organizer.displayName ?? active.organizer.email}</p>
                    </div>
                  ) : null}
                </div>

                {active.guests.length > 0 ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" /> {rsvpCounts(active.guests)}</p>
                    <ul className="space-y-1.5">
                      {active.guests.slice(0, 12).map((g, i) => (
                        <li key={g.email} className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ backgroundColor: AVATAR_BG[i % AVATAR_BG.length], color: AVATAR_FG[i % AVATAR_FG.length] }}>
                            {initials(g.displayName ?? g.email)}
                          </span>
                          <span className="truncate text-xs text-slate-700" title={g.email}>{g.displayName ?? g.email}</span>
                          {g.responseStatus === "accepted" ? <span className="ml-auto text-[10px] text-emerald-600">yes</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
