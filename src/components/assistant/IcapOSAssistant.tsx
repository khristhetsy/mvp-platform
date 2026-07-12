"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { suggestedPromptChips } from "@/lib/assistant/assistant-actions";
import { modeIntroLabel } from "@/lib/assistant/assistant-prompts";
import { ASSISTANT_DISCLAIMER } from "@/lib/assistant/assistant-policy";
import type { AssistantChatResponse, AssistantMode } from "@/lib/assistant/types";
import { resolveWorkspaceFromPath } from "@/lib/workspace-nav";

type ChatEntry = {
  role: "user" | "assistant";
  text: string;
};

const HISTORY_WINDOW = 20;

function inferClientMode(pathname: string, workspace: ReturnType<typeof resolveWorkspaceFromPath>): AssistantMode {
  // Founder pages
  if (pathname.startsWith("/founder/learning")) return "learning";
  if (pathname.startsWith("/founder/readiness") || pathname.startsWith("/founder/report")) return "reports_guidance";
  if (pathname.startsWith("/founder/capital-raise")) return "capital_raise";
  if (pathname.startsWith("/founder/deal-room")) return "deal_room";
  if (pathname.startsWith("/founder/contacts") || pathname.startsWith("/admin/marketing/contacts")) return "crm";
  if (pathname.startsWith("/billing")) return "billing";
  if (pathname.startsWith("/admin/tasks") || pathname.startsWith("/founder/tasks")) return "tasks";
  // SPV / compliance / reports
  if (pathname.includes("/spv") || pathname.startsWith("/investor/spvs")) return "spv_guidance";
  if (pathname.startsWith("/admin/compliance")) return "compliance_guidance";
  if (pathname.startsWith("/admin/reports")) return "reports_guidance";
  // Meetings → meeting-aware assistant
  if (pathname.startsWith("/admin/meetings")) return "meeting";
  // CEO Hub → Chief of Staff
  if (pathname.startsWith("/admin/ceo")) return "ceo_hub";
  // Investor Relations Hub → IR assistant
  if (pathname.startsWith("/admin/playbook")) return "ir_hub";
  // Admin marketing → CMO AI
  if (pathname.startsWith("/admin/marketing")) return "cmo_marketing";
  // Investor pages
  if (
    pathname.startsWith("/investor/watchlist") ||
    pathname.startsWith("/investor/opportunities") ||
    pathname.startsWith("/investor/interest-pipeline")
  ) return "investor_pipeline";
  if (pathname.startsWith("/investor/portfolio") || pathname.startsWith("/investor/deals")) return "investor_portfolio";
  if (pathname.startsWith("/deals") || pathname.startsWith("/investor/matching")) return "investor_matching";
  if (pathname.startsWith("/investor/deal-room")) return "deal_room";

  if (workspace === "admin") return "admin_operations";
  if (workspace === "investor") return "investor_workflow";
  return "founder_workflow";
}

export function IcapOSAssistant() {
  const t = useTranslations("sharedCmp");
  const pathname = usePathname() ?? "";
  const workspace = resolveWorkspaceFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AssistantChatResponse | null>(null);
  const [openAiAvailable, setOpenAiAvailable] = useState<boolean | null>(null);
  const [agentRequested, setAgentRequested] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedLoggedRef = useRef(false);
  const prevModeRef = useRef<string | null>(null);
  const sendMessageRef = useRef<((t: string) => Promise<void>) | null>(null);

  const mode = useMemo(() => inferClientMode(pathname, workspace), [pathname, workspace]);
  const promptChips = useMemo(
    () =>
      suggestedPromptChips({
        role: workspace === "admin" ? "admin" : workspace === "investor" ? "investor" : "founder",
        mode,
        workspaceLabel: "iCapOS",
        currentPath: pathname,
        entity: null,
        summary: {},
        highlights: [],
      }),
    [mode, pathname, workspace],
  );

  const intro = modeIntroLabel(mode, workspace === "admin" ? "admin" : workspace === "investor" ? "investor" : "founder");

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open || openedLoggedRef.current) return;
    openedLoggedRef.current = true;
    void fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "opened",
        mode,
        currentPath: pathname,
      }),
    }).catch(() => {
      openedLoggedRef.current = false;
    });
  }, [open, mode, pathname]);

  // Reset chat when page context changes
  useEffect(() => {
    if (prevModeRef.current !== null && prevModeRef.current !== mode) {
      setMessages([]);
      setLastResponse(null);
      setError(null);
      openedLoggedRef.current = false;
    }
    prevModeRef.current = mode;
  }, [mode]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setLastResponse(null);
    setError(null);
    openedLoggedRef.current = false;
  }, []);

  // Let hub cards deep-link a question into the assistant: dashboards dispatch
  // window CustomEvent("icapos-assistant:ask", { detail: { prompt } }).
  useEffect(() => {
    function onAsk(e: Event) {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      if (prompt) void sendMessageRef.current?.(prompt);
    }
    window.addEventListener("icapos-assistant:ask", onAsk as EventListener);
    return () => window.removeEventListener("icapos-assistant:ask", onAsk as EventListener);
  }, []);

  const requestLiveAgent = useCallback(async () => {
    setAgentLoading(true);
    try {
      await fetch("/api/assistant/live-agent-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPath: pathname }),
      });
      setAgentRequested(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Your request has been sent. Someone from our team will reach out via Messages shortly. I'm still here if you have questions in the meantime.",
        },
      ]);
    } catch {
      // silently fail — don't interrupt the user
    } finally {
      setAgentLoading(false);
    }
  }, [pathname]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setMessage("");
      setLoading(true);
      setError(null);

      // Sliding window — keep last HISTORY_WINDOW messages
      const history = messages.slice(-HISTORY_WINDOW).map((entry) => ({
        role: entry.role,
        content: entry.text.split("\n\n")[0] ?? entry.text,
      }));

      try {
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            mode,
            currentPath: pathname,
            history,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "Assistant unavailable.");
        }

        const body = (await response.json()) as AssistantChatResponse & { openAiAvailable?: boolean };
        setOpenAiAvailable(body.openAiAvailable ?? null);
        setLastResponse(body);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `${body.answer}\n\n${body.safetyNotes[0] ?? ASSISTANT_DISCLAIMER}`,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Assistant unavailable.");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, mode, pathname],
  );

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  if (pathname.startsWith("/founder/learning")) {
    return null;
  }

  if (!workspace) {
    return null;
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close assistant backdrop"
          className="fixed inset-0 z-[90] bg-slate-900/20 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          id="capitalos-assistant-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capitalos-assistant-title"
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-[4.5rem] sm:right-4 sm:left-auto sm:w-[400px] sm:max-h-[min(560px,82vh)] sm:rounded-2xl"
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
                <p id="capitalos-assistant-title" className="text-sm font-semibold text-slate-900">
                  {mode === "cmo_marketing" ? "CMO AI" : mode === "ceo_hub" ? "Chief of Staff" : mode === "meeting" ? "Meeting AI" : mode === "ir_hub" ? "Investor Relations" : mode === "investor_pipeline" || mode === "investor_portfolio" || mode === "investor_matching" ? "Analysis AI" : "iCapOS AI"}
                </p>
                <p className="truncate text-[10px] leading-none text-slate-500" style={{ maxWidth: 180 }}>
                  {intro.length > 44 ? intro.slice(0, 44) + "…" : intro}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {openAiAvailable === false ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  Guided
                </span>
              ) : null}
              {messages.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear chat"
                  onClick={clearChat}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                <p className="text-xs leading-5 text-slate-600">{intro}</p>
              </div>
            ) : (
              messages.map((entry, index) =>
                entry.role === "user" ? (
                  <div key={`u-${index}`} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm leading-5 text-white">
                      {entry.text}
                    </p>
                  </div>
                ) : (
                  <div key={`a-${index}`} className="flex items-start gap-2">
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
                <span className="text-xs text-slate-400" role="status" aria-live="polite">{t("preparing_guidance")}</span>
              </div>
            ) : null}
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {lastResponse?.suggestedActions?.length ? (
            <div className="shrink-0 border-t border-slate-100 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("suggested_actions")}</p>
              <div className="flex flex-wrap gap-1.5">
                {lastResponse.suggestedActions.slice(0, 4).map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
                    onClick={() => setOpen(false)}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-slate-100 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {promptChips.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
              {workspace === "founder" ? (
                <button
                  type="button"
                  disabled={agentLoading || agentRequested}
                  onClick={() => void requestLiveAgent()}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
                >
                  {agentRequested ? "✓ Agent requested" : agentLoading ? "Requesting…" : "Request a live agent"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 p-3">
            <label htmlFor="capitalos-assistant-message" className="sr-only">
              Message iCapOS Assistant
            </label>
            <input
              id="capitalos-assistant-message"
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage(message);
              }}
              placeholder={t("ask_about_this_workspace")}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void sendMessage(message)}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 active:scale-95"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <footer className="shrink-0 border-t border-slate-100 px-4 py-2 text-[10px] leading-4 text-slate-400">
            {ASSISTANT_DISCLAIMER}
          </footer>
        </div>
      ) : null}

      {/* FAB toggle */}
      <button
        type="button"
        aria-label={open ? "Close iCapOS Assistant" : "Open iCapOS Assistant"}
        aria-expanded={open}
        aria-controls="capitalos-assistant-dialog"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Sparkles className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </>
  );
}
