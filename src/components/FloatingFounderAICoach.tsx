"use client";

import { useEffect, useRef, useState } from "react";
import { COACH_DISCLAIMER } from "@/lib/learning/class-assistant-guardrails";
import {
  getCoachQuickPrompts,
  useFounderPersonalCoachChat,
} from "@/components/useFounderPersonalCoachChat";

function IcoSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" strokeLinejoin="round" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" strokeLinejoin="round" />
    </svg>
  );
}

function IcoSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" strokeLinejoin="round" />
    </svg>
  );
}

function IcoClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

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
    claudeAvailable,
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
          className="fixed inset-0 z-[90] bg-slate-900/20 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="iCapOS AI Coach"
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-[4.5rem] sm:right-4 sm:left-auto sm:w-[380px] sm:max-h-[min(540px,82vh)] sm:rounded-2xl"
        >
          {/* Gradient accent bar */}
          <div
            className="h-[3px] w-full shrink-0 rounded-t-2xl"
            style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)" }}
          />

          <header className="flex shrink-0 items-center justify-between gap-3 bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                AI
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">AI Coach</p>
                <p className="text-[10px] leading-none text-slate-500">iCapOS Learning</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {claudeAvailable === false ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  Guided
                </span>
              ) : mode === "claude" ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Live
                </span>
              ) : null}
              <button
                type="button"
                aria-label="Close coach"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <IcoClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {claudeAvailable === false && messages.length === 0 ? (
            <p className="shrink-0 border-y border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
              Guided educational mode. Quiz answers are never provided.
            </p>
          ) : null}

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <p className="text-xs leading-5 text-slate-600">
                  Ask about lessons, courses, pitch decks, data rooms, financials, or platform navigation. No quiz answers or legal/investment advice.
                </p>
                <p className="mt-1.5 text-[10px] text-slate-400">{COACH_DISCLAIMER}</p>
              </div>
            ) : (
              messages.map((entry, i) =>
                entry.role === "user" ? (
                  <div key={`u-${i}`} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm leading-5 text-white">
                      {entry.text}
                    </p>
                  </div>
                ) : (
                  <div key={`a-${i}`} className="flex items-start gap-2">
                    <div
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                    >
                      AI
                    </div>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 text-sm leading-5 text-slate-800 ring-1 ring-slate-200/60">
                      {entry.text}
                    </p>
                  </div>
                )
              )
            )}
            {loading ? (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  AI
                </div>
                <span className="text-xs text-slate-400">Thinking…</span>
              </div>
            ) : null}
          </div>

          {quickPrompts.length > 0 ? (
            <div className="shrink-0 border-t border-slate-100 px-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => sendPrompt(prompt)}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 p-3">
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
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              disabled={loading}
              onClick={send}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 active:scale-95"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <IcoSend className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* FAB toggle */}
      <button
        type="button"
        aria-label={open ? "Close AI Coach" : "Open AI Coach"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        {open ? (
          <IcoClose className="h-5 w-5 text-white" />
        ) : (
          <IcoSparkles className="h-5 w-5 text-white" />
        )}
      </button>
    </>
  );
}
