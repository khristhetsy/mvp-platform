"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { mapSegment } from "@/lib/icfo-events/segments";
import type { SessionSegment } from "@/lib/icfo-events/segments";

type Row = Record<string, unknown>;
function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

/** Staff run-of-show editor for a talk show: define ordered segments and mark
 *  the one currently on air. The public couch reflects it live. */
export function SegmentRunOfShow({ sessionId, eventId }: { sessionId: string; eventId: string }) {
  const t = useTranslations("eventsAdmin.segments");
  const [segments, setSegments] = useState<SessionSegment[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await raw(supabase).from("session_segments").select("*").eq("session_id", sessionId).order("position");
      if (active) setSegments(((data ?? []) as Row[]).map(mapSegment));
    })();
    const ch = supabase
      .channel(`segments_admin:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_segments", filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setSegments((prev) => prev.filter((s) => s.id !== String((payload.old as Row).id)));
          return;
        }
        const seg = mapSegment(payload.new as Row);
        setSegments((prev) =>
          (prev.some((x) => x.id === seg.id) ? prev.map((x) => (x.id === seg.id ? seg : x)) : [...prev, seg]).sort((a, b) => a.position - b.position),
        );
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId]);

  const ordered = [...segments].sort((a, b) => a.position - b.position);
  const total = ordered.length;

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    await fetch(`/api/admin/events/sessions/${sessionId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, title: title.trim() }),
    });
    setTitle("");
    setBusy(false);
  }
  async function setStatus(id: string, status: "pending" | "live" | "done") {
    await fetch(`/api/admin/events/sessions/${sessionId}/segments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }
  async function remove(id: string) {
    await fetch(`/api/admin/events/sessions/${sessionId}/segments/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("runOfShow")}</p>
      <div className="mt-2 space-y-1.5">
        {ordered.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t("empty")}</p>
        ) : (
          ordered.map((s, i) => {
            const live = s.status === "live";
            return (
              <div key={s.id} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5">
                <span className="min-w-0 truncate text-sm text-[var(--navy)]">
                  <span className="mr-2 text-xs text-[var(--text-muted)]">{t("segmentOf", { i: i + 1, total })}</span>
                  {s.title}
                  {live && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                      <Radio className="h-3 w-3" /> {t("onAir")}
                    </span>
                  )}
                  {s.status === "done" && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{t("done")}</span>}
                </span>
                <div className="flex shrink-0 gap-2">
                  {!live && (
                    <button onClick={() => setStatus(s.id, "live")} className="text-xs font-medium text-[var(--blue)] hover:underline">
                      {t("goLive")}
                    </button>
                  )}
                  {live && (
                    <button onClick={() => setStatus(s.id, "done")} className="text-xs font-medium text-emerald-700 hover:underline">
                      {t("endSegment")}
                    </button>
                  )}
                  <button onClick={() => remove(s.id)} className="text-xs text-rose-600 hover:underline">
                    {t("remove")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("placeholder")}
          maxLength={120}
          className="flex-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
        />
        <button onClick={add} disabled={busy || !title.trim()} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50">
          {t("add")}
        </button>
      </div>
    </div>
  );
}
