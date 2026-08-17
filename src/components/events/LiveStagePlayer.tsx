import type { ReactNode } from "react";
import type { EventSession } from "@/lib/icfo-events/types";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { embeddableLiveUrl } from "@/lib/icfo-events/video/external";

function fmtSchedule(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** The large 16:9 "stage" surface shared by the Main Stage, Talk Show, and
 *  Tracks rooms. Renders the live embed when one is configured, a join button for
 *  non-embeddable hosts (Zoom/Meet), or a scheduled/idle placeholder otherwise.
 *  `joinUrlOverride` forces a specific join link (e.g. the Talk Show's fixed Zoom
 *  room) regardless of the session's own video link. */
export function LiveStagePlayer({
  session,
  badge,
  viewerSlot,
  caption,
  joinUrlOverride,
  joinLabel,
}: {
  session: EventSession | null;
  badge: string;
  viewerSlot?: ReactNode;
  caption?: string;
  joinUrlOverride?: string | null;
  joinLabel?: string;
}) {
  const isLive = session?.status === "live";
  const wherebyEmbed =
    isLive && session?.videoProvider === "whereby" && session.videoRef
      ? getVideoProvider("whereby").embedUrl(session.videoRef)
      : null;
  const externalEmbed =
    isLive && session?.videoProvider === "external" && session.videoRef
      ? embeddableLiveUrl(session.videoRef)
      : null;
  const embed = wherebyEmbed ?? externalEmbed;
  // When live and not embeddable, show a join button. An explicit override (the
  // Talk Show Zoom room) wins over the session's own external link.
  const joinLink =
    isLive && !embed
      ? joinUrlOverride ??
        (session?.videoProvider === "external" && session.videoRef ? session.videoRef : null)
      : null;
  const idleText = isLive
    ? "Live now"
    : session?.startsAt
      ? `Scheduled for ${fmtSchedule(session.startsAt)}`
      : session
        ? "Not live yet"
        : "Nothing scheduled here yet";

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-subtle)]"
      style={{ background: "#0a1422" }}
    >
      {isLive && (
        <span
          className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: "#E24B4A" }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
          {badge}
        </span>
      )}
      {viewerSlot && (
        <span className="absolute right-3 top-3 z-10 text-xs" style={{ color: "#cdd6e4" }}>
          {viewerSlot}
        </span>
      )}

      {embed ? (
        <iframe
          title={session?.title ?? "Live session"}
          src={embed}
          allow="camera; microphone; autoplay; fullscreen; picture-in-picture; encrypted-media; display-capture"
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="h-16 w-16 rounded-full" style={{ background: "#1c2c44" }} aria-hidden />
          {joinLink ? (
            <a
              href={joinLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: "#1D9E75" }}
            >
              {joinLabel ?? "Join the live session"} ↗
            </a>
          ) : (
            <p className="text-sm" style={{ color: "#8e9bb0" }}>
              {idleText}
            </p>
          )}
        </div>
      )}

      {(session?.title || caption) && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-4">
          {session?.title && <p className="text-sm font-semibold text-white">{session.title}</p>}
          {caption && <p className="mt-0.5 text-xs" style={{ color: "#aeb8c7" }}>{caption}</p>}
        </div>
      )}
    </div>
  );
}
