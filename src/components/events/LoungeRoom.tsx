"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useEventPresence } from "@/components/events/EventPresenceProvider";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { mapLoungeTable, mapLoungeMessage } from "@/lib/icfo-events/lounge";
import type { LoungeTable, LoungeMessage } from "@/lib/icfo-events/lounge";

type Me = { id: string; name: string };
type Row = Record<string, unknown>;

function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export function LoungeRoom({
  eventId,
  me,
  initialTables,
}: {
  eventId: string;
  me: Me;
  initialTables: LoungeTable[];
}) {
  const t = useTranslations("eventsCmp");
  const { muted } = useEventPresence();
  const [tables, setTables] = useState<LoungeTable[]>(initialTables);
  const [selectedId, setSelectedId] = useState<string | null>(initialTables[0]?.id ?? null);
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [present, setPresent] = useState<{ id: string; name: string }[]>([]);
  const [input, setInput] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  // name lookup for realtime messages (presence carries names keyed by user id)
  const nameById = useRef<Map<string, string>>(new Map([[me.id, me.name]]));
  const endRef = useRef<HTMLDivElement>(null);

  // New tables stream (so everyone sees a freshly created table).
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`lounge_tables:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lounge_tables", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const t = mapLoungeTable(payload.new as Row);
          setTables((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [eventId]);

  // Selected table: load history + subscribe to presence and new messages.
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();
    let active = true;

    (async () => {
      const { data } = await raw(supabase)
        .from("lounge_messages")
        .select("*, profiles:profile_id(full_name)")
        .eq("table_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      const msgs = ((data ?? []) as Row[]).map(mapLoungeMessage).reverse();
      msgs.forEach((m) => nameById.current.set(m.profileId, m.authorName));
      setMessages(msgs);
    })();

    const ch = supabase
      .channel(`lounge:${selectedId}`, { config: { presence: { key: me.id } } })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ id?: string; name?: string }>>;
        const people = Object.values(state)
          .flat()
          .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? "Attendee") }))
          .filter((p) => p.id);
        const seen = new Set<string>();
        const unique = people.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
        unique.forEach((p) => nameById.current.set(p.id, p.name));
        setPresent(unique);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lounge_messages", filter: `table_id=eq.${selectedId}` },
        (payload) => {
          const r = payload.new as Row;
          const pid = String(r.profile_id);
          const msg: LoungeMessage = {
            id: String(r.id),
            tableId: String(r.table_id),
            profileId: pid,
            authorName: pid === me.id ? me.name : nameById.current.get(pid) ?? "Attendee",
            body: String(r.body),
            createdAt: String(r.created_at),
          };
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ id: me.id, name: me.name });
      });

    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [selectedId, me.id, me.name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || !selectedId) return;
    setInput("");
    setError(null);
    const supabase = createClient();
    const { error: err } = await raw(supabase)
      .from("lounge_messages")
      .insert({ event_id: eventId, table_id: selectedId, profile_id: me.id, body });
    if (err) setError("Couldn't send message.");
  }

  async function createTable() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await raw(supabase)
      .from("lounge_tables")
      .insert({ event_id: eventId, title, created_by: me.id })
      .select("*")
      .single();
    if (err || !data) {
      setError("Couldn't create table.");
      return;
    }
    const t = mapLoungeTable(data as Row);
    setTables((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
    setSelectedId(t.id);
  }

  const selected = tables.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      {/* Tables list */}
      <aside className="rounded-xl border border-[var(--border-subtle)] bg-white p-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-[var(--navy)]">{t("topic_tables")}</h2>
        </div>
        <ul className="mt-2 space-y-1">
          {tables.length === 0 && (
            <li className="px-2 py-3 text-xs text-[var(--text-muted)]">{t("no_tables_yet_start_one_below")}</li>
          )}
          {tables.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  selectedId === t.id
                    ? "bg-[var(--indigo-soft)] font-medium text-[var(--indigo)]"
                    : "text-[var(--text-secondary)] hover:bg-slate-50"
                }`}
              >
                {t.title}
                {t.sectorSlug && <span className="ml-1 text-xs text-[var(--text-muted)]">· {sectorLabel(t.sectorSlug)}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("new_table_topic")}
            maxLength={120}
            className="w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && createTable()}
          />
          <button
            onClick={createTable}
            disabled={!newTitle.trim()}
            className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
          >
            Start a table
          </button>
        </div>
      </aside>

      {/* Active table */}
      <div className="flex min-h-[420px] flex-col rounded-xl border border-[var(--border-subtle)] bg-white">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div>
                <h3 className="font-semibold text-[var(--navy)]">{selected.title}</h3>
                {selected.topic && <p className="text-xs text-[var(--text-muted)]">{selected.topic}</p>}
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]" title={present.map((p) => p.name).join(", ")}>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                {present.length} here
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("no_messages_yet_say_hello")}</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className={`font-medium ${m.profileId === me.id ? "text-[var(--indigo)]" : "text-[var(--navy)]"}`}>
                      {m.profileId === me.id ? "You" : m.authorName}
                    </span>{" "}
                    <span className="text-[var(--text-secondary)]">{m.body}</span>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            {muted ? (
              <div className="border-t border-[var(--border-subtle)] p-3 text-center text-sm text-[var(--text-muted)]">
                You’ve been muted by a moderator and can’t post in chat.
              </div>
            ) : (
              <div className="flex gap-2 border-t border-[var(--border-subtle)] p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("message_the_table")}
                  maxLength={1000}
                  className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                />
                <button onClick={send} disabled={!input.trim()} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                  Send
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
            Pick a table to join the conversation.
          </div>
        )}
        {error && <p className="px-4 pb-3 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
