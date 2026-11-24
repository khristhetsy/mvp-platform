"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/icfo-events/spotlight/rules";
import { nextLineupIndex } from "@/lib/icfo-events/studio";
import { loadYouTubeApi, type YTPlayer } from "@/lib/icfo-events/youtube-api";

export type MonitorItem = { id: string; name: string; company: string | null; youtubeVideoId: string };
export type MonitorState = { index: number; phase: "idle" | "break" | "video" };

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** Program and Preview monitors for the Spotlight lineup. Plays the approved
 *  pitches in order with the same rules as the public tab: a hard cutoff at
 *  maxSeconds, then a break, then the next pitch. Nothing is edited or recorded. */
export function SpotlightMonitors({
  items,
  maxSeconds,
  breakSeconds,
  onState,
}: {
  items: MonitorItem[];
  maxSeconds: number;
  breakSeconds: number;
  onState: (s: MonitorState) => void;
}) {
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<MonitorState["phase"]>("idle");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  const count = items.length;
  const current = index >= 0 ? (items[index] ?? null) : null;
  const preview = items[nextLineupIndex(index, count)] ?? null;

  const take = useCallback((i: number, withBreak: boolean) => {
    const t = Date.now();
    setIndex(i);
    setPhase(withBreak ? "break" : "video");
    setStartedAt(t);
    setNow(t);
  }, []);

  const advance = useCallback(() => take(nextLineupIndex(index, count), true), [take, index, count]);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const stop = useCallback(() => {
    setPhase("idle");
    setIndex(-1);
    playerRef.current?.destroy();
    playerRef.current = null;
  }, []);

  useEffect(() => {
    onState({ index, phase });
  }, [index, phase, onState]);

  // Clock and the two automatic hand-overs: the hard cutoff, and the end of the break.
  useEffect(() => {
    if (phase === "idle") return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const elapsed = (t - startedAt) / 1000;
      if (phase === "video" && elapsed >= maxSeconds) advanceRef.current();
      if (phase === "break" && elapsed >= breakSeconds) {
        setPhase("video");
        setStartedAt(t);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [phase, startedAt, maxSeconds, breakSeconds]);

  // Load each pitch into the one player. endSeconds is the hard cutoff.
  useEffect(() => {
    if (phase !== "video" || !current) return;
    let cancelled = false;
    (async () => {
      if (playerRef.current) {
        playerRef.current.loadVideoById({ videoId: current.youtubeVideoId, endSeconds: maxSeconds });
        return;
      }
      const YT = await loadYouTubeApi();
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: current.youtubeVideoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, end: maxSeconds },
        events: {
          onReady: () => playerRef.current?.playVideo(),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) advanceRef.current();
          },
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, current, maxSeconds]);

  useEffect(() => () => playerRef.current?.destroy(), []);

  if (count === 0) {
    return <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">Approve a pitch and it appears on the monitors.</div>;
  }

  const elapsed = phase === "idle" ? 0 : Math.max(0, (now - startedAt) / 1000);
  const shown = phase === "video" ? Math.min(elapsed, maxSeconds) : 0;
  const breakLeft = Math.max(0, Math.ceil(breakSeconds - elapsed));

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-rose-500 bg-[#0a0f1b] text-white">
          <div className={phase === "video" ? "absolute inset-0" : "hidden"}>
            <div ref={hostRef} />
          </div>
          <span className="absolute left-2 top-2 z-10 rounded bg-rose-500 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wider">PROGRAM</span>
          <span className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums">
            {formatClock(Math.floor(shown))} / {formatClock(maxSeconds)}
          </span>
          {phase === "idle" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-400">
              <b className="text-base text-slate-200">Not playing</b>Press Play lineup
            </div>
          ) : null}
          {phase === "break" ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0f1b]/95 text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400">Break {breakLeft}s, up next</span>
              <b className="mt-1 text-base">{current?.name}</b>
              <span className="text-xs text-slate-300">{current?.company ?? ""}</span>
            </div>
          ) : null}
          {phase === "video" && current ? (
            <div className="pointer-events-none absolute bottom-3 left-2 z-10 rounded bg-black/55 px-2 py-1 text-xs">
              <b className="block text-[13px]">{current.name}</b>
              {current.company ?? ""}
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-white/20">
            <div className="h-full bg-rose-500" style={{ width: `${phase === "video" ? (shown / maxSeconds) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-emerald-600 bg-[#0a0f1b] text-white" style={preview ? { backgroundImage: `url(${thumb(preview.youtubeVideoId)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <span className="absolute left-2 top-2 z-10 rounded bg-emerald-600 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wider">PREVIEW</span>
          <span className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums">{formatClock(maxSeconds)}</span>
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs">
            <b className="block text-[13px]">{preview?.name}</b>Next up
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {phase === "idle" ? (
          <button type="button" onClick={() => take(0, false)} className="rounded-md bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">Play lineup</button>
        ) : (
          <>
            <button type="button" onClick={() => take(nextLineupIndex(index, count), false)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Take next now</button>
            <button type="button" onClick={stop} className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-slate-50">Stop</button>
          </>
        )}
      </div>
    </div>
  );
}
