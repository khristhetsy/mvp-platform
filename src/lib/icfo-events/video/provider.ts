// Swappable video provider — mirrors the e-sign PdfConverter abstraction.
// v1 ships the RecordedVideoProvider (no live dependency). Phase 2+ can plug a
// live provider (Daily / Zoom / Whereby / LiveKit) behind the same interface
// without touching the session UI.

import { sessionVideoSignedUrl } from "./storage";
import { WherebyVideoProvider } from "./whereby";

export interface CreateRoomInput {
  sessionId: string;
  title: string;
}

export interface CreatedRoom {
  /** Opaque provider reference stored in sessions.video_ref. */
  ref: string;
  /** URL a participant/host opens to join (live) or play (recorded). */
  joinUrl: string;
}

export interface VideoProvider {
  readonly name: string;
  /** Provision a room (live) or a playback handle (recorded). */
  createRoom(input: CreateRoomInput): Promise<CreatedRoom>;
  /** iframe src for embedding the session, given its stored ref. */
  embedUrl(ref: string): string;
  /** Signed recording URL, if available. */
  recordingUrl(ref: string): Promise<string | null>;
}

/**
 * Recorded provider: there's no live room. The "ref" is the storage path of the
 * uploaded recording; join/embed/recording all resolve to a signed playback URL.
 */
export class RecordedVideoProvider implements VideoProvider {
  readonly name = "recorded";

  async createRoom(_input: CreateRoomInput): Promise<CreatedRoom> {
    // No provisioning needed for recorded sessions; the recording path is the ref.
    return { ref: "", joinUrl: "" };
  }

  embedUrl(_ref: string): string {
    // Recorded playback uses a native <video> element with a signed URL fetched
    // server-side, not an iframe — so there's no static embed src.
    return "";
  }

  async recordingUrl(ref: string): Promise<string | null> {
    return sessionVideoSignedUrl(ref);
  }
}

/** Resolve the active provider. Defaults to recorded; "whereby" enables live. */
export function getVideoProvider(providerName?: string | null): VideoProvider {
  switch (providerName) {
    case "whereby":
      return new WherebyVideoProvider();
    case "recorded":
    default:
      return new RecordedVideoProvider();
  }
}
