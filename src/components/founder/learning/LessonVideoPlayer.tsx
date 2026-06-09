"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoSlide } from "@/lib/learning/video/video-types";

type Props = {
  videoUrl: string;
  posterUrl?: string;
  initialPositionSeconds?: number;
  slides?: VideoSlide[];
  courseSlug: string;
  lessonSlug: string;
  onProgress?: (percent: number) => void;
};

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export function LessonVideoPlayer({
  videoUrl,
  posterUrl,
  initialPositionSeconds = 0,
  slides = [],
  courseSlug,
  lessonSlug,
  onProgress,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const fired10 = useRef(false);
  const fired90 = useRef(false);
  const lastSaveRef = useRef(0);

  const chapterMarkers = useMemo(() => {
    if (!slides.length) return [] as Array<{ slide: VideoSlide; startSeconds: number }>;
    let cumulative = 0;
    return slides.map((slide) => {
      const startSeconds = cumulative;
      cumulative += slide.durationSeconds;
      return { slide, startSeconds };
    });
  }, [slides]);

  const currentChapter = useMemo(() => {
    if (!chapterMarkers.length || !duration) return null;
    const current = videoRef.current?.currentTime ?? 0;
    let active = chapterMarkers[0];
    for (const marker of chapterMarkers) {
      if (current >= marker.startSeconds) active = marker;
    }
    return active.slide;
  }, [chapterMarkers, duration, progress]);

  const savePosition = useCallback(
    async (positionSeconds: number) => {
      await fetch("/api/founder/learning/video-metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, lessonSlug, positionSeconds: Math.floor(positionSeconds) }),
      }).catch(() => undefined);
    },
    [courseSlug, lessonSlug],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (initialPositionSeconds > 0) {
      video.currentTime = initialPositionSeconds;
    }
  }, [initialPositionSeconds, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const current = video.currentTime;
      const total = video.duration || 1;
      const percent = (current / total) * 100;
      setProgress(percent);

      if (!fired10.current && percent >= 10) {
        fired10.current = true;
        onProgress?.(10);
      }
      if (!fired90.current && percent >= 90) {
        fired90.current = true;
        onProgress?.(90);
      }

      const now = Date.now();
      if (now - lastSaveRef.current >= 10_000) {
        lastSaveRef.current = now;
        void savePosition(current);
      }
    };

    const onLoaded = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [onProgress, savePosition]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setProgress(duration > 0 ? (seconds / duration) * 100 : 0);
  }

  function toggleFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void video.requestFullscreen?.();
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black text-white shadow-lg">
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl}
        className="aspect-video w-full bg-black"
        playsInline
        preload="metadata"
      />

      {chapterMarkers.length > 0 ? (
        <div className="relative h-2 bg-slate-800">
          <div className="absolute inset-y-0 left-0 bg-indigo-500" style={{ width: `${progress}%` }} />
          {chapterMarkers.map(({ slide, startSeconds }) => {
            const left = duration > 0 ? (startSeconds / duration) * 100 : 0;
            return (
              <button
                key={slide.id}
                type="button"
                title={slide.title}
                onClick={() => seekTo(startSeconds)}
                className="absolute top-0 h-full w-1 -translate-x-1/2 bg-indigo-300 hover:bg-indigo-200"
                style={{ left: `${left}%` }}
              />
            );
          })}
        </div>
      ) : (
        <div className="h-2 bg-slate-800">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="space-y-2 px-4 py-3">
        {currentChapter ? (
          <p className="text-xs font-medium text-indigo-200">Chapter: {currentChapter.title}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            {playing ? "Pause" : "Play"}
          </button>

          <label className="flex items-center gap-2 text-xs text-slate-200">
            Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVolume(next);
                if (videoRef.current) videoRef.current.volume = next;
              }}
              className="w-20 accent-indigo-500"
            />
          </label>

          <select
            value={speed}
            onChange={(e) => {
              const next = Number(e.target.value);
              setSpeed(next);
              if (videoRef.current) videoRef.current.playbackRate = next;
            }}
            className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-xs"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            Fullscreen
          </button>

          <span className="ml-auto text-xs text-slate-300">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
