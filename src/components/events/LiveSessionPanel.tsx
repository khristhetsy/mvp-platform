"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { SessionQuestion, SessionChatMessage } from "@/lib/icfo-events/live-session";

type Me = { id: string; name: string };
type Row = Record<string, unknown>;
const REACTIONS = ["👏", "❤️", "🎉", "🔥", "💡"];

function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export function LiveSessionPanel({
  sessionId,
  eventId,
  me,
  isStaff,
  initialQuestions,
  initialChat,
}: {
  sessionId: string;
  eventId: string;
  me: Me;
  isStaff: boolean;
  initialQuestions: SessionQuestion[];
  initialChat: SessionChatMessage[];
}) {
  const t = useTranslations("eventsCmp");
  const [tab, setTab] = useState<"qa" | "chat">("qa");
  const [questions, setQuestions] = useState<SessionQuestion[]>(initialQuestions);
  const [chat, setChat] = useState<SessionChatMessage[]>(initialChat);
  const [qInput, setQInput] = useState("");
  const [cInput, setCInput] = useState("");
  const [floats, setFloats] = useState<{ id: number; emoji: string }[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nameById = useRef<Map<string, string>>(new Map([[me.id, me.name]]));

  useEffect(() => {
    initialQuestions.forEach((q) => nameById.current.set(q.profileId, q.authorName));
    initialChat.forEach((m) => nameById.current.set(m.profileId, m.authorName));
  }, [initialQuestions, initialChat]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`live:${sessionId}`, { config: { broadcast: { self: true } } });
    channelRef.current = ch;

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "session_questions", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const r = payload.new as Row;
        if (r.is_hidden) return;
        const pid = String(r.profile_id);
        setQuestions((prev) =>
          prev.some((q) => q.id === String(r.id))
            ? prev
            : [
                ...prev,
                {
                  id: String(r.id),
                  sessionId: String(r.session_id),
                  profileId: pid,
                  authorName: pid === me.id ? me.name : nameById.current.get(pid) ?? "Attendee",
                  body: String(r.body),
                  isAnswered: Boolean(r.is_answered),
                  upvotes: 0,
                  votedByMe: false,
                  createdAt: String(r.created_at),
                },
              ],
        );
      },
    )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_questions", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const r = payload.new as Row;
          const id = String(r.id);
          if (r.is_hidden) {
            setQuestions((prev) => prev.filter((q) => q.id !== id));
            return;
          }
          setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isAnswered: Boolean(r.is_answered) } : q)));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_question_votes", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const r = payload.new as Row;
          const qid = String(r.question_id);
          const mineVote = String(r.profile_id) === me.id;
          setQuestions((prev) =>
            prev.map((q) => (q.id === qid ? { ...q, upvotes: q.upvotes + 1, votedByMe: q.votedByMe || mineVote } : q)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "session_question_votes", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const r = payload.old as Row;
          const qid = String(r.question_id);
          const mineVote = String(r.profile_id) === me.id;
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === qid ? { ...q, upvotes: Math.max(0, q.upvotes - 1), votedByMe: mineVote ? false : q.votedByMe } : q,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const r = payload.new as Row;
          const pid = String(r.profile_id);
          setChat((prev) =>
            prev.some((m) => m.id === String(r.id))
              ? prev
              : [
                  ...prev,
                  {
                    id: String(r.id),
                    sessionId: String(r.session_id),
                    profileId: pid,
                    authorName: pid === me.id ? me.name : nameById.current.get(pid) ?? "Attendee",
                    body: String(r.body),
                    createdAt: String(r.created_at),
                  },
                ],
          );
        },
      )
      .on("broadcast", { event: "reaction" }, (payload) => {
        const emoji = String((payload.payload as { emoji?: string })?.emoji ?? "👏");
        const id = Date.now() + Math.random();
        setFloats((prev) => [...prev, { id, emoji }]);
        setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 2400);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
      channelRef.current = null;
    };
  }, [sessionId, me.id, me.name]);

  useEffect(() => {
    if (tab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, tab]);

  async function submitQuestion() {
    const body = qInput.trim();
    if (!body) return;
    setQInput("");
    await raw(createClient())
      .from("session_questions")
      .insert({ session_id: sessionId, event_id: eventId, profile_id: me.id, body });
  }

  async function toggleVote(q: SessionQuestion) {
    const supabase = createClient();
    if (q.votedByMe) {
      await raw(supabase).from("session_question_votes").delete().eq("question_id", q.id).eq("profile_id", me.id);
    } else {
      await raw(supabase)
        .from("session_question_votes")
        .insert({ question_id: q.id, session_id: sessionId, profile_id: me.id });
    }
  }

  async function setAnswered(q: SessionQuestion) {
    await raw(createClient()).from("session_questions").update({ is_answered: !q.isAnswered }).eq("id", q.id);
  }
  async function hide(q: SessionQuestion) {
    await raw(createClient()).from("session_questions").update({ is_hidden: true }).eq("id", q.id);
  }

  async function sendChat() {
    const body = cInput.trim();
    if (!body) return;
    setCInput("");
    await raw(createClient())
      .from("session_chat_messages")
      .insert({ session_id: sessionId, event_id: eventId, profile_id: me.id, body });
  }

  function react(emoji: string) {
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  }

  const sortedQuestions = [...questions].sort(
    (a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <div className="relative mt-3 rounded-xl border border-[var(--border-subtle)] bg-white">
      {/* floating reactions */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-12 right-6 text-2xl"
            style={{ animation: "cap-float 2.4s ease-out forwards" }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("qa")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${tab === "qa" ? "bg-[var(--indigo-soft)] text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}
          >
            Q&amp;A
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${tab === "chat" ? "bg-[var(--indigo-soft)] text-[var(--indigo)]" : "text-[var(--text-secondary)]"}`}
          >
            Chat
          </button>
        </div>
        <div className="flex gap-1">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => react(e)} className="rounded-md px-1.5 py-1 text-lg hover:bg-slate-50" aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {tab === "qa" ? (
        <div className="p-3">
          <div className="flex gap-2">
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitQuestion()}
              placeholder={t("ask_a_question")}
              maxLength={500}
              className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
            <button onClick={submitQuestion} disabled={!qInput.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              Ask
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {sortedQuestions.length === 0 ? (
              <li className="text-sm text-[var(--text-muted)]">{t("no_questions_yet_be_the_first_to_ask")}</li>
            ) : (
              sortedQuestions.map((q) => (
                <li key={q.id} className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                  <button
                    onClick={() => toggleVote(q)}
                    className={`flex flex-none flex-col items-center rounded-md border px-2 py-1 text-xs font-semibold ${
                      q.votedByMe ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    }`}
                    aria-label="Upvote"
                  >
                    ▲<span>{q.upvotes}</span>
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">{q.body}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {q.profileId === me.id ? "You" : q.authorName}
                      {q.isAnswered && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{t("answered")}</span>}
                    </p>
                    {isStaff && (
                      <div className="mt-1 flex gap-2">
                        <button onClick={() => setAnswered(q)} className="text-xs text-[var(--blue)] hover:underline">
                          {q.isAnswered ? "Unmark" : "Mark answered"}
                        </button>
                        <button onClick={() => hide(q)} className="text-xs text-rose-600 hover:underline">
                          Hide
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="flex h-72 flex-col p-3">
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {chat.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t("no_messages_yet")}</p>
            ) : (
              chat.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className={`font-medium ${m.profileId === me.id ? "text-[var(--indigo)]" : "text-[var(--navy)]"}`}>
                    {m.profileId === me.id ? "You" : m.authorName}
                  </span>{" "}
                  <span className="text-[var(--text-secondary)]">{m.body}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={cInput}
              onChange={(e) => setCInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={t("message")}
              maxLength={1000}
              className="flex-1 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            />
            <button onClick={sendChat} disabled={!cInput.trim()} className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
