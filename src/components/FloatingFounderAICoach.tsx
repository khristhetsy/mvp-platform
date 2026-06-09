"use client";

import { useEffect, useRef, useState } from "react";
import { COACH_DISCLAIMER } from "@/lib/learning/class-assistant-guardrails";
import {
  getCoachQuickPrompts,
  useFounderPersonalCoachChat,
} from "@/components/useFounderPersonalCoachChat";

export function FloatingFounderAICoach({
  courseSlug,
  lessonSlug,
}: Readonly<{
  courseSlug?: string;
  lessonSlug?: string;
}>) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    message,
    setMessage,
    messages,
    loading,
    mode,
    openAiAvailable,
    send,
    sendPrompt,
  } = useFounderPersonalCoachChat({ courseSlug, lessonSlug });

  const quickPrompts = getCoachQuickPrompts({ courseSlug, lessonSlug });

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close coach backdrop"
          className="fixed inset-0 z-[90] bg-slate-900/40 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CapitalOS AI Coach"
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-4 sm:left-auto sm:w-[380px] sm:max-h-[min(520px,80vh)] sm:rounded-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 bg-slate-900 px-4 py-3 text-white sm:rounded-t-2xl">
            <div className="min-w-0">
              <p className="text-sm font-semibold">CapitalOS AI Coach</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-300">{COACH_DISCLAIMER}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {openAiAvailable === false ? (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-100">
                  Guided
                </span>
              ) : mode === "openai" ? (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-100">
                  Live
                </span>
              ) : null}
              <button
                type="button"
                aria-label="Close coach"
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          </header>

          {openAiAvailable === false && messages.length === 0 ? (
            <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-950">
              Guided educational mode (OpenAI not configured). Quiz answers are never provided.
            </p>
          ) : null}

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 ? (
              <p className="text-slate-600">
                Ask about lessons, courses, pitch decks, data rooms, financials, or platform navigation. No quiz
                answers or legal/investment advice.
              </p>
            ) : (
              messages.map((entry, i) => (
                <p
                  key={`${entry.role}-${i}`}
                  className={`whitespace-pre-wrap rounded-lg px-3 py-2 ${
                    entry.role === "user"
                      ? "ml-4 bg-slate-100 text-slate-800"
                      : "mr-2 bg-indigo-50 text-indigo-950"
                  }`}
                >
                  {entry.text}
                </p>
              ))
            )}
            {loading ? <p className="text-xs text-slate-400">Coach is thinking…</p> : null}
          </div>

          <div className="shrink-0 border-t border-slate-100 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => sendPrompt(prompt)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3">
            <input
              type="text"
              aria-label="Message AI coach"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={
                lessonSlug
                  ? "Ask about this lesson…"
                  : courseSlug
                    ? "Ask about this course…"
                    : "Ask about founder courses…"
              }
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={send}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Close AI Coach" : "Open AI Coach"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-2 ring-white hover:bg-slate-800"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-base leading-none">
          💬
        </span>
        <span className="hidden sm:inline">{open ? "Close" : "AI Coach"}</span>
      </button>
    </>
  );
}
