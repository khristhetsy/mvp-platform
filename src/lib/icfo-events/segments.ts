// Talk Show run-of-show segments. The host defines an ordered list and marks the
// current one live; the public couch shows "Segment N of M · <title>".

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Row = Record<string, unknown>;
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type SegmentStatus = "pending" | "live" | "done";

export interface SessionSegment {
  id: string;
  sessionId: string;
  title: string;
  status: SegmentStatus;
  position: number;
}

/** Pure row → domain mapper (safe to import into client components). */
export function mapSegment(r: Row): SessionSegment {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    title: String(r.title),
    status: (r.status as SegmentStatus) ?? "pending",
    position: Number(r.position ?? 0),
  };
}

export async function loadSegments(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<SessionSegment[]> {
  const { data } = await raw(supabase)
    .from("session_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  return ((data ?? []) as Row[]).map(mapSegment);
}

/** Display label for the segment currently on air, e.g. "Segment 2 of 4 · The raise". */
export function liveSegmentLabel(segments: SessionSegment[]): string | null {
  const ordered = [...segments].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((s) => s.status === "live");
  if (idx < 0) return null;
  return `Segment ${idx + 1} of ${ordered.length} · ${ordered[idx].title}`;
}
