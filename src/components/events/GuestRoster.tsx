"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { mapSessionGuest } from "@/lib/icfo-events/live-session";
import type { SessionGuest } from "@/lib/icfo-events/live-session";

type Row = Record<string, unknown>;
function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

/** Admin roster for a talk-show session: add guests, swap on/off stage. */
export function GuestRoster({ sessionId, eventId }: { sessionId: string; eventId: string }) {
  const t = useTranslations("eventsCmp");
  const [guests, setGuests] = useState<SessionGuest[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await raw(supabase).from("session_guests").select("*").eq("session_id", sessionId).order("position");
      if (active) setGuests(((data ?? []) as Row[]).map(mapSessionGuest));
    })();
    const ch = supabase
      .channel(`guests_admin:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_guests", filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setGuests((prev) => prev.filter((g) => g.id !== String((payload.old as Row).id)));
          return;
        }
        const g = mapSessionGuest(payload.new as Row);
        setGuests((prev) => (prev.some((x) => x.id === g.id) ? prev.map((x) => (x.id === g.id ? g : x)) : [...prev, g]));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch(`/api/admin/events/sessions/${sessionId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, displayName: name, roleLabel: role || null }),
    });
    setName("");
    setRole("");
    setBusy(false);
  }
  async function setStatus(id: string, status: "onstage" | "backstage") {
    await fetch(`/api/admin/events/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }
  async function remove(id: string) {
    await fetch(`/api/admin/events/guests/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("guest_roster")}</p>
      <div className="mt-2 space-y-1.5">
        {guests.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t("no_guests_yet")}</p>
        ) : (
          guests.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5">
              <span className="text-sm text-[var(--navy)]">
                {g.displayName}
                {g.roleLabel && <span className="ml-1 text-xs text-[var(--text-muted)]">· {g.roleLabel}</span>}
                {g.status === "onstage" && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">{t("on_stage")}</span>}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatus(g.id, g.status === "onstage" ? "backstage" : "onstage")}
                  className="text-xs font-medium text-[var(--blue)] hover:underline"
                >
                  {g.status === "onstage" ? "Send back" : "Bring on"}
                </button>
                <button onClick={() => remove(g.id)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("guest_name")} className="flex-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("role_optional")} className="w-32 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm" />
        <button onClick={add} disabled={busy || !name.trim()} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  );
}
