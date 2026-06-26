// Whereby Embedded provider. Creates a room via the Whereby REST API and returns
// an embeddable room URL. No SDK — the room is a plain iframe src, matching the
// "embed, never build" rule. Needs WHEREBY_API_KEY.

import type { VideoProvider, CreateRoomInput, CreatedRoom } from "./provider";

const WHEREBY_API = "https://api.whereby.dev/v1/meetings";

export function isLiveVideoConfigured(): boolean {
  return Boolean(process.env.WHEREBY_API_KEY);
}

interface WherebyMeetingResponse {
  meetingId: string;
  roomUrl: string;
  hostRoomUrl?: string;
  endDate: string;
}

export class WherebyVideoProvider implements VideoProvider {
  readonly name = "whereby";

  async createRoom(input: CreateRoomInput): Promise<CreatedRoom & { hostUrl?: string }> {
    const apiKey = process.env.WHEREBY_API_KEY;
    if (!apiKey) throw new Error("Live video is not configured (missing WHEREBY_API_KEY).");

    // Room is valid for 24h from creation; group mode for panels/showcases.
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(WHEREBY_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        endDate,
        roomMode: "group",
        fields: ["hostRoomUrl"],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Whereby room creation failed ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as WherebyMeetingResponse;
    return { ref: json.roomUrl, joinUrl: json.roomUrl, hostUrl: json.hostRoomUrl ?? json.roomUrl };
  }

  embedUrl(ref: string): string {
    // Whereby room URLs are embeddable directly; ?embed enables embed chrome.
    if (!ref) return "";
    return ref.includes("?") ? `${ref}&embed` : `${ref}?embed`;
  }

  async recordingUrl(): Promise<string | null> {
    // Cloud recordings are retrieved out-of-band; the recorded provider serves
    // archived sessions from Storage instead.
    return null;
  }
}
