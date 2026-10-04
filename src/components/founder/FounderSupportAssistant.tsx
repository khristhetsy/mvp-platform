"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Handoff = { requestId: string; ownerName: string | null; dueAt: string | null };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Set when the assistant passed the question to a person. */
  handoff?: Handoff | null;
  /** The question an AI answer replied to, for "That solved it" feedback. */
  question?: string | null;
  feedback?: "solved" | "person" | null;
};

/** "Tue, Oct 6, 10:00 AM" in the founder's own time zone. */
function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function HandoffCard({ h }: Readonly<{ h: Handoff }>) {
  const due = formatDue(h.dueAt);
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700">
          {(h.ownerName ?? "iCapOS").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-900">{h.ownerName ?? "Our team"} has your request</p>
          {due ? <p className="text-[11.5px] text-slate-500">Reply expected by {due}</p> : null}
        </div>
      </div>
      <a href={`/founder/support?request=${h.requestId}`} className="mt-2 inline-block text-[12px] font-medium text-indigo-600 hover:underline">
        Track my request
      </a>
    </div>
  );
}

const DEFAULT_PROMPTS = [
  "How do investor matches work?",
  "When are my investor identities revealed?",
  "What does my plan include?",
];

// Stage-aware starters so the suggestions match where the founder actually is.
const STAGE_PROMPTS: Record<string, string[]> = {
  onboarding: [
    "What do I need to finish onboarding?",
    "How is my Capital Readiness Rating calculated?",
    "What happens after I complete Stage 1?",
  ],
  preparation: [
    "Which 3 documents do I need to upload?",
    "What readiness score do I need to advance?",
    "What happens when I submit for review?",
  ],
  marketing: [
    "How do I open a data room?",
    "When are my investor identities revealed?",
    "How do brokered intro requests work?",
  ],
  closing: [
    "How do I track investor commitments?",
    "What does the SPV Program do?",
    "What are my next steps to close?",
  ],
};

export function FounderSupportAssistant({
  founderName,
  stageSlug = null,
}: Readonly<{ founderName: string; stageSlug?: string | null }>) {
  const router = useRouter();
  const firstName = founderName.split(" ")[0] || founderName;
  const prompts = (stageSlug && STAGE_PROMPTS[stageSlug]) || DEFAULT_PROMPTS;

  const greeting: ChatMessage = {
    role: "assistant",
    content: `Hi ${firstName} 👋 I can help with your raise — matches, documents, moving between stages, billing, and more. What are you working on?`,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<"idle" | "sending" | "sent">("idle");
  // Once a person has the conversation, later messages join that request instead of opening another.
  const [handedTo, setHandedTo] = useState<Handoff | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    if (handedTo) {
      try {
        const res = await fetch(`/api/founder/support/${handedTo.requestId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: content }),
        });
        if (!res.ok) {
          setError("Couldn't add that to your request. Try again.");
          return;
        }
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Added to your request. ${handedTo.ownerName ?? "Our team"} will see it.` },
        ]);
      } catch {
        setError("Network error. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/founder/support/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send only the real turns (skip the local greeting) so the model sees a clean thread.
        body: JSON.stringify({ messages: next.slice(1).map((m) => ({ role: m.role, content: m.content })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.reply) {
        setError(json.error ?? "Couldn't reach the assistant. Try again.");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: json.reply,
          handoff: json.handoff ?? null,
          question: json.answered ? content : null,
        },
      ]);
      if (json.handoff) {
        setHandoff("sent");
        setHandedTo(json.handoff);
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function giveFeedback(index: number, solved: boolean) {
    const msg = messages[index];
    if (!msg || msg.feedback) return;
    setMessages((m) => m.map((x, i) => (i === index ? { ...x, feedback: solved ? "solved" : "person" } : x)));
    void fetch("/api/founder/support/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: msg.question ?? "", solved }),
    }).catch(() => {});
    if (!solved) await handOff();
  }

  async function handOff() {
    if (handoff !== "idle") return;
    setHandoff("sending");
    const transcript = messages
      .slice(1)
      .map((m) => `${m.role === "user" ? "Founder" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    const firstQuestion = messages.find((m) => m.role === "user")?.content ?? "Assistant conversation";
    const subject = `Assistant handoff: ${firstQuestion.slice(0, 120)}`;
    try {
      const res = await fetch("/api/founder/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body: transcript ? `Handed off from the assistant.\n\n${transcript}` : "Handed off from the assistant.",
          source: "request_help",
          contextItem: "Assistant",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHandoff("idle");
        setError("Couldn't reach the team just now. Try again.");
        return;
      }
      setHandoff("sent");
      if (json.id) setHandedTo({ requestId: json.id, ownerName: json.ownerName ?? null, dueAt: json.dueAt ?? null });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I've passed our conversation to a person.",
          handoff: json.id ? { requestId: json.id, ownerName: json.ownerName ?? null, dueAt: json.dueAt ?? null } : null,
        },
      ]);
      router.refresh();
    } catch {
      setHandoff("idle");
      setError("Network error handing off. Try again.");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <i className="ti ti-sparkles text-base" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-slate-900">iCapOS Assistant</p>
          <p className="flex items-center gap-1 text-[11px] text-emerald-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            AI · answers questions about using iCapOS
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" ? (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                <i className="ti ti-sparkles text-[13px]" aria-hidden="true" />
              </div>
            ) : null}
            <div
              className={`max-w-[82%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === "user" ? "bg-indigo-600 text-white" : "border border-slate-100 bg-slate-50 text-slate-700"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.handoff ? <HandoffCard h={m.handoff} /> : null}
              {m.role === "assistant" && m.question && i === messages.length - 1 && !busy ? (
                m.feedback ? (
                  <p className="mt-2 text-[11.5px] text-slate-400">
                    {m.feedback === "solved" ? "Thanks. Glad that helped." : "Passing this to a person…"}
                  </p>
                ) : handoff !== "sent" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => giveFeedback(i, true)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50">
                      <i className="ti ti-thumb-up mr-1" aria-hidden="true" />That solved it
                    </button>
                    <button type="button" onClick={() => giveFeedback(i, false)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50">
                      <i className="ti ti-user mr-1" aria-hidden="true" />I still need a person
                    </button>
                  </div>
                ) : null
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <i className="ti ti-sparkles text-[13px]" aria-hidden="true" />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-400">Thinking…</div>
          </div>
        ) : null}

        {messages.length === 1 && !busy ? (
          <div className="flex flex-wrap gap-2 pl-8 pt-1">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] text-indigo-600 hover:bg-indigo-50"
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        {error ? <p className="mb-2 text-[12px] font-medium text-red-600">{error}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={handedTo ? `Add a message for ${handedTo.ownerName ?? "the team"}…` : "Ask anything about your raise…"}
            disabled={busy}
            className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <i className="ti ti-arrow-up text-base" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-2.5 text-center text-[11px] text-slate-400">
          {handoff === "sent" ? (
            <span className="text-emerald-600">Handed off — the iCapOS team has your conversation and will reply in your requests below.</span>
          ) : (
            <>
              Can&apos;t resolve it?{" "}
              <button
                type="button"
                onClick={handOff}
                disabled={handoff === "sending"}
                className="font-medium text-indigo-600 hover:underline disabled:opacity-60"
              >
                {handoff === "sending" ? "Handing off…" : "Hand off to the iCapOS team"}
              </button>{" "}
              — usually replies within 1 business day.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
