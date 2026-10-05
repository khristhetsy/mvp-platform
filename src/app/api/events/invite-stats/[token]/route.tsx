/**
 * The live numbers image in invitation emails. Drawn when the email is opened,
 * so the counts are current at that moment; also records the open.
 *
 * Counts only, never names. An invalid token gets an empty image, not an error,
 * so a mail client never shows a broken picture.
 */
import { ImageResponse } from "next/og";
import { invitationFromToken, markOpened } from "@/lib/icfo-events/invitations/store";
import { getLiveCounts } from "@/lib/icfo-events/invitations/live-stats";
import { loadEvents, statEventIds, upcomingEvents } from "@/lib/icfo-events/invitations/runner";
import { STAT_ORDER, statTiles, type StatTile } from "@/lib/icfo-events/invitations/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const W = 1040;

function image(tiles: StatTile[], leadKey: string | null): ImageResponse {
  const rows: StatTile[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));
  const H = Math.max(rows.length, 1) * 150 + 40;
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: 20, background: "#f8fafc", borderRadius: 20, gap: 12 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 12 }}>
            {row.map((t) => (
              <div
                key={t.key}
                style={{
                  flex: 1, height: 126, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "#ffffff", borderRadius: 16, border: `3px solid ${t.key === leadKey ? "#1d5fd1" : "#dfe4ec"}`,
                }}
              >
                <div style={{ fontSize: t.counted ? 48 : 30, fontWeight: 700, color: t.counted ? "#1a4fb0" : "#8a97ab" }}>{t.value}</div>
                <div style={{ fontSize: 22, color: "#5b6b82", marginTop: 4, textAlign: "center" }}>{t.label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const inv = await invitationFromToken(decodeURIComponent(token)).catch(() => null);
  if (!inv) return image([], null);
  await markOpened(inv.id).catch(() => undefined);
  const events = upcomingEvents(await loadEvents(inv.campaign.eventIds));
  const counts = await getLiveCounts(statEventIds(inv.campaign, events));
  const order = STAT_ORDER[inv.role];
  return image(statTiles(counts, inv.campaign.stats, order), order[0]);
}
