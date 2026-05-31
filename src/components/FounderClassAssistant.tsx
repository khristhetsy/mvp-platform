"use client";

import { useState } from "react";

const DISCLAIMER =
  "Educational founder training only. No quiz answers, legal, tax, securities, or investment advice. No funding guarantees.";

export function FounderClassAssistant({
  courseSlug,
  lessonSlug,
}: Readonly<{ courseSlug: string; lessonSlug: string }>) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/founder/learning/class-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, lessonSlug, message: trimmed }),
    });

    setLoading(false);

    if (!response.ok) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Unable to reach the class assistant. Try again shortly." },
      ]);
      return;
    }

    const body = (await response.json()) as { reply: string; disclaimer?: string };
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `${body.reply}\n\n${body.disclaimer ?? DISCLAIMER}` },
    ]);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">AI class assistant</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{DISCLAIMER}</p>
      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
        {messages.length === 0 ? (
          <p className="text-slate-500">Ask about this lesson’s concepts. Quiz answers are not provided.</p>
        ) : (
          messages.map((entry, i) => (
            <p
              key={`${entry.role}-${i}`}
              className={`whitespace-pre-wrap rounded-md px-3 py-2 ${
                entry.role === "user" ? "bg-white text-slate-800" : "bg-indigo-50 text-indigo-950"
              }`}
            >
              {entry.text}
            </p>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Ask about this lesson…"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void send()}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}
