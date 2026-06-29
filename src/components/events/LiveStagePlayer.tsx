import type { ReactNode } from "react";
import type { EventSession } from "@/lib/icfo-events/types";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { embeddableLiveUrl } from "@/lib/icfo-events/video/external";

/** The large 16:9 "stage" surface shared by the Main Stage, Talk Show, and
 *  Tracks rooms. Renders the live embed when one is configured, a join link for
 *  non-embeddable hosts (Zoom/Meet), or an idle placeholder otherwise. */
export function LiveStagePlayer({
  session,
  badge,
  viewerSlot,
  caption,
}: {
  session: EventSession | null;
  badge: string;
  viewerSlot?: ReactNode;
  caption?: string;
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
  const joinLink =
    isLive && session?.videoProvider === "external" && session.videoRef && !externalEmbed
      ? session.videoRef
      : null;

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

      {wherebyEmbed || externalEmbed ? (
        <iframe
          title={session?.title ?? "Live session"}
          src={(wherebyEmbed ?? externalEmbed) as string}
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
              Join the live session ↗
            </a>
          ) : (
            <p className="text-sm" style={{ color: "#8e9bb0" }}>
              {isLive ? "Live now" : session ? "Not live yet" : "Nothing scheduled here yet"}
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
