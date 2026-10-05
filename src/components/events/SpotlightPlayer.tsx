"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, SkipForward, Store } from "lucide-react";
import { SPOTLIGHT_INTRO_SECONDS } from "@/lib/icfo-events/spotlight/rules";
import type { SpotlightPlaylistItem } from "@/lib/icfo-events/spotlight/service";

// Minimal typing for the YouTube IFrame Player API (loaded from youtube.com).
type YTPlayer = { loadVideoById: (id: string) => void; playVideo: () => void; destroy: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

const LOWER_THIRD_MS = 8000;

export function SpotlightPlayer({ items, sectorLabels }: { items: SpotlightPlaylistItem[]; sectorLabels: Record<string, string> }) {
  const [track, setTrack] = useState<string>("all");
  const list = useMemo(() => (track === "all" ? items : items.filter((i) => i.sectorSlug === track)), [items, track]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "intro" | "video">("ready");
  // Timers are driven by timestamps set in event handlers; effects only tick a clock.
  const [introStartedAt, setIntroStartedAt] = useState(0);
  const [videoStartedAt, setVideoStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const nextRef = useRef<() => void>(() => {});

  const current = list[index] ?? null;
  const tracks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.sectorSlug) counts.set(i.sectorSlug, (counts.get(i.sectorSlug) ?? 0) + 1);
    return [...counts.entries()];
  }, [items]);

  const goTo = useCallback((i: number) => {
    const t = Date.now();
    setIndex(i);
    setPhase("intro");
    setIntroStartedAt(t);
    setNow(t);
  }, []);
  const next = useCallback(() => {
    goTo(index + 1 < list.length ? index + 1 : 0);
  }, [goTo, index, list.length]);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // Intro card: tick the clock, then hand over to the video.
  useEffect(() => {
    if (phase !== "intro") return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    const done = setTimeout(() => {
      const t = Date.now();
      setVideoStartedAt(t);
      setNow(t);
      setPhase("video");
    }, Math.max(0, introStartedAt + SPOTLIGHT_INTRO_SECONDS * 1000 - Date.now()));
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [phase, introStartedAt]);

  // Keep the clock moving while the lower third is up.
  useEffect(() => {
    if (phase !== "video") return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const stop = setTimeout(() => clearInterval(tick), LOWER_THIRD_MS + 600);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [phase, videoStartedAt]);

  const elapsedIntro = Math.max(0, now - introStartedAt);
  const countdown = Math.max(0, Math.ceil((SPOTLIGHT_INTRO_SECONDS * 1000 - elapsedIntro) / 1000));
  const showLowerThird = phase === "video" && now - videoStartedAt < LOWER_THIRD_MS;

  // Create the player once, then load each video in turn.
  useEffect(() => {
    if (phase !== "video" || !current) return;
    let cancelled = false;
    (async () => {
      if (playerRef.current) {
        playerRef.current.loadVideoById(current.youtubeVideoId);
        return;
      }
      const YT = await loadYouTubeApi();
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: current.youtubeVideoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => playerRef.current?.playVideo(),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) nextRef.current();
          },
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, current]);

  useEffect(() => () => playerRef.current?.destroy(), []);

  if (items.length === 0) {
    return (
      <div className="bg-white p-10 text-center">
        <p className="text-base font-semibold text-[var(--text-primary)]">Founder Spotlight</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Approved founder pitches appear here once the lineup is published.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6">
      {tracks.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setTrack("all"); goTo(0); }}
            className={`rounded-full px-3 py-1 text-xs ${track === "all" ? "bg-[#1A6CE4] text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}
          >
            All tracks {items.length}
          </button>
          {tracks.map(([slug, n]) => (
            <button
              key={slug}
              type="button"
              onClick={() => { setTrack(slug); goTo(0); }}
              className={`rounded-full px-3 py-1 text-xs ${track === slug ? "bg-[#1A6CE4] text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}
            >
              {sectorLabels[slug] ?? slug} {n}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative aspect-video overflow-hidden rounded-xl bg-[#0A1A40]">
        <div className={phase === "video" ? "absolute inset-0" : "hidden"}>
          <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        </div>

        {phase === "ready" && current ? (
          <button type="button" onClick={() => goTo(0)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <span className="rounded-full bg-[#1A6CE4] px-5 py-2.5 text-sm font-semibold">Start the Spotlight</span>
            <span className="text-xs text-[#B5D4F4]">{list.length} founder pitches, about 3 minutes each</span>
          </button>
        ) : null}

        {phase === "intro" && current ? (
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <p className="text-[11px] uppercase tracking-wide text-[#85B7EB]">Up next · {countdown}s</p>
            <p className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{current.companyName ?? current.displayName}</p>
            <p className="text-sm text-[#B5D4F4]">
              {current.displayName}
              {current.sectorSlug ? ` · ${sectorLabels[current.sectorSlug] ?? current.sectorSlug}` : ""}
            </p>
            {current.intro ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90">{current.intro}</p> : null}
            <div className="mt-4 h-1 w-full overflow-hidden rounded bg-[#185FA5]">
              <div className="h-1 bg-white transition-all duration-1000" style={{ width: `${((SPOTLIGHT_INTRO_SECONDS - countdown) / SPOTLIGHT_INTRO_SECONDS) * 100}%` }} />
            </div>
          </div>
        ) : null}

        {phase === "video" && showLowerThird && current ? (
          <div className="pointer-events-none absolute bottom-14 left-4 rounded-md bg-[#1A6CE4] px-3 py-2 text-white">
            <p className="text-sm font-semibold">{current.displayName}</p>
            <p className="text-xs">{current.companyName ?? ""}{current.sectorSlug ? ` · ${sectorLabels[current.sectorSlug] ?? current.sectorSlug}` : ""}</p>
          </div>
        ) : null}
      </div>

      {current ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {current.boothSponsorId ? (
            <Link href={`/events/sponsors/${current.boothSponsorId}`} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
              <Store className="h-4 w-4" /> Visit booth
            </Link>
          ) : null}
          {current.meetingUrl ? (
            <a href={current.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
              <CalendarClock className="h-4 w-4" /> Request meeting
            </a>
          ) : null}
          <button type="button" onClick={next} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-slate-50">
            <SkipForward className="h-4 w-4" /> Next pitch
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Lineup</p>
        <ol className="mt-1 divide-y divide-slate-100 rounded-lg border border-[var(--border-subtle)]">
          {list.map((item, i) => (
            <li key={item.presenterId}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === index && phase !== "ready" ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                <span className="w-5 text-xs text-[var(--text-muted)]">{i + 1}</span>
                <span className="flex-1 text-[var(--text-primary)]">{item.companyName ?? item.displayName}</span>
                <span className="text-xs text-[var(--text-muted)]">{item.sectorSlug ? (sectorLabels[item.sectorSlug] ?? item.sectorSlug) : ""}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
