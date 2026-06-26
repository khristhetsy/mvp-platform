"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Hand } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CallInEntry, CallInStatus } from "@/lib/icfo-events/live-session";

type Me = { id: string; name: string };
type Row = Record<string, unknown>;

function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export function CallInBar({
  sessionId,
  eventId,
  me,
  isStaff,
  roomUrl,
  initialQueue,
}: {
  sessionId: string;
  eventId: string;
  me: Me;
  isStaff: boolean;
  roomUrl: string | null;
  initialQueue: CallInEntry[];
}) {
  const [queue, setQueue] = useState<CallInEntry[]>(initialQueue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`callin:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_callin_queue", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const r = payload.old as Row;
            setQueue((prev) => prev.filter((e) => e.id !== String(r.id)));
            return;
          }
          const r = payload.new as Row;
          const status = r.status as CallInStatus;
          const entry: CallInEntry = {
            id: String(r.id),
            profileId: String(r.profile_id),
            name: String(r.profile_id) === me.id ? me.name : "Attendee",
            status,
            createdAt: String(r.created_at),
          };
          setQueue((prev) => {
            if (status === "done") return prev.filter((e) => e.id !== entry.id);
            const exists = prev.find((e) => e.id === entry.id);
            // preserve a known name from the initial server load
            const name = exists?.name && exists.name !== "Attendee" ? exists.name : entry.name;
            const next = exists
              ? prev.map((e) => (e.id === entry.id ? { ...entry, name } : e))
              : [...prev, entry];
            return next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId, me.id, me.name]);

  const myEntry = queue.find((e) => e.profileId === me.id) ?? null;

  async function raiseHand() {
    setBusy(true);
    await raw(createClient())
      .from("session_callin_queue")
      .insert({ session_id: sessionId, event_id: eventId, profile_id: me.id });
    setBusy(false);
  }
  async function withdraw() {
    setBusy(true);
    await raw(createClient()).from("session_callin_queue").delete().eq("session_id", sessionId).eq("profile_id", me.id);
    setBusy(false);
  }
  async function setStatus(id: string, status: CallInStatus) {
    await raw(createClient()).from("session_callin_queue").update({ status }).eq("id", id);
  }

  // ── Host view ───────────────────────────────────────────────────────────────
  if (isStaff) {
    const active = queue.filter((e) => e.status !== "done");
    return (
      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-white p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
          <Hand className="h-4 w-4" /> Call-in queue ({active.length})
        </h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No raised hands yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {active.map((e, i) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <span className="text-sm text-[var(--navy)]">
                  <span className="mr-2 text-xs text-[var(--text-muted)]">{i + 1}.</span>
                  {e.name}
                  {e.status !== "requested" && (
                    <span className="ml-2 rounded bg-[var(--indigo-soft)] px-1.5 py-0.5 text-xs capitalize text-[var(--indigo)]">{e.status}</span>
                  )}
                </span>
                <div className="flex gap-2">
                  {e.status === "requested" && (
                    <button onClick={() => setStatus(e.id, "invited")} className="text-xs font-medium text-[var(--blue)] hover:underline">
                      Invite
                    </button>
                  )}
                  {e.status === "invited" && (
                    <button onClick={() => setStatus(e.id, "onstage")} className="text-xs font-medium text-emerald-700 hover:underline">
                      On stage
                    </button>
                  )}
                  <button onClick={() => setStatus(e.id, "done")} className="text-xs text-rose-600 hover:underline">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Attendee view ─────────────────────────────────────────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-white p-3">
      {!myEntry && (
        <button
          onClick={raiseHand}
          disabled={busy}
          className="cap-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <Hand className="h-4 w-4" /> Raise hand to speak
        </button>
      )}
      {myEntry?.status === "requested" && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">✋ Hand raised — waiting for the host.</span>
          <button onClick={withdraw} disabled={busy} className="text-xs text-rose-600 hover:underline disabled:opacity-50">
            Lower hand
          </button>
        </div>
      )}
      {myEntry?.status === "invited" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-emerald-700">🎤 You&apos;re invited to come on!</span>
          {roomUrl && (
            <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="cap-btn-primary rounded-md px-3 py-1.5 text-sm font-medium">
              Join with camera →
            </a>
          )}
        </div>
      )}
      {myEntry?.status === "onstage" && <span className="text-sm font-medium text-[var(--indigo)]">🎙️ You&apos;re on stage.</span>}
    </div>
  );
}
