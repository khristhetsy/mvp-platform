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

type UserHit = { id: string; name: string; email: string; role: string };

/** Admin roster for a talk-show session: add guests, swap on/off stage. Guests
 *  are linked to a platform user so the live stage can match them to their Zoom
 *  video tile (session_guests.profile_id === Video SDK user_identity). */
export function GuestRoster({ sessionId, eventId }: { sessionId: string; eventId: string }) {
  const t = useTranslations("eventsCmp");
  const [guests, setGuests] = useState<SessionGuest[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [picked, setPicked] = useState<UserHit | null>(null);
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

  // Debounced platform-user search for the picker. A linked user is required so
  // the live stage can match the guest to their Zoom video tile.
  useEffect(() => {
    if (picked) return; // already chosen; don't re-search
    let active = true;
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (q.length < 1) {
        if (active) setHits([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/events/guests/search-users?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const { users } = (await res.json()) as { users: UserHit[] };
        if (active) setHits(users);
      } catch {
        /* ignore autocomplete errors */
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, picked]);

  async function add() {
    if (!picked) return;
    setBusy(true);
    await fetch(`/api/admin/events/sessions/${sessionId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        displayName: picked.name,
        roleLabel: role || null,
        profileId: picked.id,
      }),
    });
    setPicked(null);
    setQuery("");
    setHits([]);
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
                  type="button"
                  onClick={() => setStatus(g.id, g.status === "onstage" ? "backstage" : "onstage")}
                  className="text-xs font-medium text-[var(--blue)] hover:underline"
                >
                  {g.status === "onstage" ? "Send back" : "Bring on"}
                </button>
                <button type="button" onClick={() => remove(g.id)} className="text-xs text-rose-600 hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-2">
        {picked ? (
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1.5 text-sm text-[var(--navy)]">
              {picked.name}
              {picked.email && <span className="text-xs text-[var(--text-muted)]">· {picked.email}</span>}
              <button type="button" onClick={() => setPicked(null)} className="ml-auto text-xs text-[var(--text-muted)] hover:text-rose-600">
                ✕
              </button>
            </span>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("role_optional")} className="w-32 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm" />
            <button type="button" onClick={add} disabled={busy} className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50">
              Add
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_a_user_by_name_or_email")}
              className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
            />
            {hits.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]">
                {hits.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(u);
                        setHits([]);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="text-[var(--navy)]">{u.name}</span>
                      {u.email && <span className="text-xs text-[var(--text-muted)]">{u.email}</span>}
                      {u.role && <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{u.role}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
