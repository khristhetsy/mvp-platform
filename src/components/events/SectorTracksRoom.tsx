"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const TYPE_LABEL: Record<string, string> = {
  keynote: "Keynote",
  panel: "Panel",
  talk_show: "Talk show",
  founder_showcase: "Founder showcase",
  workshop: "Workshop",
};

export type TrackAgendaItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  startsAt: string | null;
};

export type TrackData = {
  sectorSlug: string;
  label: string;
  isLive: boolean;
  now: {
    title: string;
    status: string;
    startsAt: string | null;
    embedUrl: string | null;
    joinUrl: string | null;
  } | null;
  agenda: TrackAgendaItem[];
};

function fmtTime(iso: string | null): string {
  if (!iso) return "TBA";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Parallel sector rooms: a track switcher that drives a now-playing player and
 *  that track's agenda, plus the live/scheduled track cards. */
export function SectorTracksRoom({ tracks }: { tracks: TrackData[] }) {
  const t = useTranslations("eventsCmp");
  const firstLive = tracks.findIndex((t) => t.isLive);
  const [active, setActive] = useState(firstLive >= 0 ? firstLive : 0);

  if (tracks.length === 0) {
    return (
      <div className="bg-white px-4 py-12 text-center text-sm text-[var(--text-muted)]">
        No sector tracks have been added to this event yet.
      </div>
    );
  }

  const track = tracks[active];

  return (
    <div className="bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {tracks.map((t, i) => (
          <button
            key={t.sectorSlug}
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              i === active
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--indigo)]"
            }`}
          >
            {t.label}
            {t.isLive && <span className="ml-1.5 text-[10px] uppercase" style={{ color: i === active ? "#9FE1CB" : "#0F6E56" }}>● live</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-subtle)]" style={{ background: "#0a1422" }}>
          {track.isLive && (
            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "#E24B4A" }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden /> LIVE
            </span>
          )}
          {track.now?.embedUrl ? (
            <iframe
              title={track.now.title}
              src={track.now.embedUrl}
              allow="camera; microphone; autoplay; fullscreen; picture-in-picture; encrypted-media; display-capture"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="h-14 w-14 rounded-full" style={{ background: "#1c2c44" }} aria-hidden />
              {track.now?.joinUrl ? (
                <a href={track.now.joinUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "#1D9E75" }}>
                  Join the live session ↗
                </a>
              ) : (
                <p className="text-sm" style={{ color: "#8e9bb0" }}>
                  {track.now ? "Not live yet" : "Nothing scheduled in this track yet"}
                </p>
              )}
            </div>
          )}
          {track.now?.title && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-sm font-semibold text-white">{track.now.title}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-3">
          <p className="text-sm font-semibold text-[var(--navy)]">{track.label} agenda</p>
          {track.agenda.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{t("sessions_will_be_announced_soon")}</p>
          ) : (
            <ul className="mt-2">
              {track.agenda.map((s) => {
                const live = s.status === "live";
                return (
                  <li key={s.id} className="flex items-start gap-3 border-b border-[var(--border-subtle)] py-2 last:border-0">
                    <span className={`w-12 shrink-0 text-xs font-medium ${live ? "text-[#0F6E56]" : "text-[var(--text-muted)]"}`}>
                      {live ? "now" : fmtTime(s.startsAt)}
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {s.title}
                      <span className="ml-1.5 text-xs text-[var(--text-muted)]">· {TYPE_LABEL[s.type] ?? s.type}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((t, i) => (
          <button
            key={t.sectorSlug}
            onClick={() => setActive(i)}
            className={`rounded-xl border p-4 text-left transition ${
              i === active ? "border-[var(--indigo)]" : "border-[var(--border-subtle)] hover:border-[var(--indigo)]"
            }`}
          >
            <p className="font-medium text-[var(--navy)]">{t.label}</p>
            <p className="mt-1 text-xs" style={{ color: t.isLive ? "#0F6E56" : "var(--text-muted)" }}>
              {t.isLive ? "● Live now" : t.now?.startsAt ? `Starts ${fmtTime(t.now.startsAt)}` : `${t.agenda.length} session${t.agenda.length === 1 ? "" : "s"}`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
