"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
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

export function CapitalOSAssistant() {
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

  const mode = useMemo(() => inferClientMode(pathname, workspace), [pathname, workspace]);
  const promptChips = useMemo(
    () =>
      suggestedPromptChips({
        role: workspace === "admin" ? "admin" : workspace === "investor" ? "investor" : "founder",
        mode,
        workspaceLabel: "CapitalOS",
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
          className="fixed inset-0 z-[90] bg-slate-900/30 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          id="capitalos-assistant-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capitalos-assistant-title"
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] sm:inset-x-auto sm:bottom-20 sm:right-4 sm:left-auto sm:w-[400px] sm:max-h-[min(560px,82vh)] sm:rounded-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-[var(--blue)] px-4 py-3 text-white sm:rounded-t-2xl">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
                <p id="capitalos-assistant-title" className="text-sm font-semibold">
                  {mode === "cmo_marketing" ? "CapitalOS CMO AI" : mode === "investor_pipeline" || mode === "investor_portfolio" || mode === "investor_matching" ? "CapitalOS Analysis AI" : "CapitalOS AI"}
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-300">{intro}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {openAiAvailable === false ? (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-100">
                  Guided
                </span>
              ) : null}
              {messages.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear chat"
                  onClick={clearChat}
                  className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white text-[11px]"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 ? (
              <p className="leading-6 text-slate-600">{intro}</p>
            ) : (
              messages.map((entry, index) => (
                <p
                  key={`${entry.role}-${index}`}
                  className={`whitespace-pre-wrap rounded-lg px-3 py-2 leading-6 ${
                    entry.role === "user" ? "ml-6 bg-slate-100 text-slate-800" : "mr-2 bg-[var(--blue-muted)] text-[var(--blue-hover)]"
                  }`}
                >
                  {entry.text}
                </p>
              ))
            )}
            {loading ? (
              <p className="text-xs text-slate-400" role="status" aria-live="polite">
                Preparing guidance…
              </p>
            ) : null}
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {lastResponse?.suggestedActions?.length ? (
            <div className="shrink-0 border-t border-slate-100 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Suggested actions</p>
              <div className="flex flex-wrap gap-1.5">
                {lastResponse.suggestedActions.slice(0, 4).map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-950 hover:border-slate-300"
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
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
              {mode === "crm" && workspace === "founder" ? (
                <button
                  type="button"
                  disabled={agentLoading || agentRequested}
                  onClick={() => void requestLiveAgent()}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  {agentRequested ? "✓ Agent requested" : agentLoading ? "Requesting…" : "Request a live agent"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3">
            <label htmlFor="capitalos-assistant-message" className="sr-only">
              Message CapitalOS Assistant
            </label>
            <input
              id="capitalos-assistant-message"
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage(message);
              }}
              placeholder="Ask about this workspace…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void sendMessage(message)}
              className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Send
            </button>
          </div>

          <footer className="shrink-0 border-t border-slate-100 px-4 py-2 text-[10px] leading-4 text-slate-500">
            {ASSISTANT_DISCLAIMER}
          </footer>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Close CapitalOS Assistant" : "Open CapitalOS Assistant"}
        aria-expanded={open}
        aria-controls="capitalos-assistant-dialog"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[var(--shadow-card)] hover:border-slate-300"
      >
        <Sparkles className="h-4 w-4 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">{open ? "Close" : "Assistant"}</span>
      </button>
    </>
  );
}
