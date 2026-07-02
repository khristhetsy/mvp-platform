"use client";

// Contextual marketing copilot. Docked launcher → slide-in chat panel. Grounded
// per topic ("aeo" on AEO pages, "cmo" on the Plan page). It can PROPOSE actions;
// nothing is written until the admin clicks Apply (advise + confirmed actions).

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const PURPLE = "#2E78F5";
type Msg = { role: "user" | "assistant"; content: string };
type Action =
  | { type: "create_aeo_page"; payload: Record<string, unknown> }
  | { type: "update_aeo_page"; payload: Record<string, unknown> }
  | { type: "run_compliance" }
  | { type: "draft_plan"; payload: { summary: string } };

const SUGGESTIONS: Record<string, string[]> = {
  aeo: ["What pillar page should I write next?", "Draft a Governance-readiness page", "Check this page for compliance language", "Suggest 3 FAQ questions"],
  cmo: ["What should I focus on this week?", "Why might open rate be low?", "Draft this week's plan", "Which segment is at risk?"],
};

export function CopilotPanel({
  topic,
  pageId,
  onApplied,
}: {
  topic: "aeo" | "cmo";
  pageId?: string;
  onApplied?: () => void;
}) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const title = topic === "aeo" ? "AEO copilot" : "AI CMO copilot";

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setAction(null); setApplyMsg(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/marketing/copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, messages: next, context: pageId ? { pageId } : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Copilot failed.");
      setMessages((m) => [...m, { role: "assistant", content: d.reply || "…" }]);
      if (d.action) setAction(d.action as Action);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong." }]);
    } finally {
      setBusy(false);
    }
  }, [messages, busy, topic, pageId]);

  const applyAction = async () => {
    if (!action) return;
    setBusy(true); setApplyMsg(null);
    try {
      if (action.type === "create_aeo_page") {
        const p = action.payload;
        const res = await fetch("/api/aeo/pages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: p.slug, h1: p.h1, eyebrow: p.eyebrow, lede: p.lede, definition_answer: p.definition_answer, defined_term: p.defined_term ?? null, meta_description: p.meta_description }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Create failed.");
        const newId = d.page.id as string;
        if (p.sections || p.faq) {
          await fetch(`/api/aeo/pages/${newId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: p.sections ?? [], faq: p.faq ?? [] }) });
        }
        setApplyMsg("Draft created — opening the editor.");
        setAction(null);
        router.push(`/admin/marketing/aeo/${newId}/edit`);
      } else if (action.type === "update_aeo_page") {
        if (!pageId) throw new Error("No page open to update.");
        const res = await fetch(`/api/aeo/pages/${pageId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.payload) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Update failed."); }
        setApplyMsg("Applied to the page. Refresh the editor to see it.");
        setAction(null);
        onApplied?.();
      } else if (action.type === "run_compliance") {
        if (!pageId) throw new Error("Open a page first.");
        const res = await fetch(`/api/aeo/pages/${pageId}/compliance`, { method: "POST" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Check failed.");
        setApplyMsg(d.status === "cleared" ? "Language check: cleared." : `Flagged ${d.violations?.length ?? 0} issue(s).`);
        setAction(null);
        onApplied?.();
      } else if (action.type === "draft_plan") {
        await navigator.clipboard.writeText(action.payload.summary).catch(() => {});
        setApplyMsg("Plan copied to clipboard — paste it on the Plan page.");
        setAction(null);
      }
    } catch (err) {
      setApplyMsg(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = action
    ? action.type === "create_aeo_page" ? "Create draft page"
      : action.type === "update_aeo_page" ? "Apply to this page"
      : action.type === "run_compliance" ? "Run language check"
      : "Copy plan"
    : "";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 55, display: "inline-flex", alignItems: "center", gap: 8, background: PURPLE, color: "#fff", border: "none", borderRadius: 999, padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 6px 20px rgb(83 74 183 / 0.35)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.8L18.7 9.6l-4.8 1.9L12 16.3l-1.9-4.8L5.3 9.6l4.8-1.9L12 3z"/></svg>
        {title}
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 55, width: 380, maxWidth: "calc(100vw - 40px)", height: 560, maxHeight: "calc(100vh - 40px)", background: "#fff", border: "0.5px solid #d7dce4", borderRadius: 16, boxShadow: "0 12px 40px rgb(12 35 64 / 0.22)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "0.5px solid #eef1f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: PURPLE, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f2147" }}>{title}</span>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#7a8494", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ color: "#5f5e5a", fontSize: 12.5 }}>
            <p style={{ margin: "0 0 10px" }}>{topic === "aeo" ? "I help you write citable /learn pages that stay compliance-safe. Ask me anything, or:" : "I'm your AI CMO. Ask about performance, segments, or this week's plan:"}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS[topic].map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} style={{ fontSize: 12, color: "#1A6CE4", background: "#EEEDFE", border: "1px solid #CECBF6", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          m.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "82%", background: "#f4f6f9", border: "0.5px solid #e6e9ef", borderRadius: "12px 12px 4px 12px", padding: "8px 11px", fontSize: 13, color: "#0f2147" }}>{m.content}</div>
          ) : (
            <div key={i} style={{ alignSelf: "flex-start", maxWidth: "90%", background: "#F6F5FC", border: "0.5px solid #E4E1F6", borderRadius: "12px 12px 12px 4px", padding: "9px 12px", fontSize: 13, lineHeight: 1.5, color: "#26215C", whiteSpace: "pre-wrap" }}>{m.content}</div>
          )
        ))}

        {busy ? <div style={{ alignSelf: "flex-start", fontSize: 12, color: "#7a8494" }}>{t("thinking")}</div> : null}

        {action ? (
          <div style={{ border: "1px solid #CECBF6", background: "#F6F5FC", borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", margin: "0 0 4px" }}>{t("proposed_action")}</p>
            <p style={{ fontSize: 11.5, color: "#5f5e5a", margin: "0 0 10px" }}>{t("nothing_is_saved_until_you_confirm")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => void applyAction()} disabled={busy} style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{actionLabel}</button>
              <button type="button" onClick={() => setAction(null)} style={{ background: "#fff", color: "#5f5e5a", border: "1px solid #d7dce4", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}>{t("dismiss")}</button>
            </div>
          </div>
        ) : null}

        {applyMsg ? <div style={{ fontSize: 12, color: "#0F6E56", background: "#E1F5EE", borderRadius: 8, padding: "7px 10px" }}>{applyMsg}</div> : null}
      </div>

      <div style={{ borderTop: "0.5px solid #eef1f5", padding: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={inputRef} rows={1} placeholder={topic === "aeo" ? "Ask about your AEO pages…" : "Ask your AI CMO…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = inputRef.current?.value ?? ""; if (inputRef.current) inputRef.current.value = ""; void send(v); } }}
          style={{ flex: 1, resize: "none", border: "1px solid #d7dce4", borderRadius: 10, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", maxHeight: 120, color: "#0f2147" }} />
        <button type="button" onClick={() => { const v = inputRef.current?.value ?? ""; if (inputRef.current) inputRef.current.value = ""; void send(v); }} disabled={busy}
          style={{ width: 34, height: 34, borderRadius: 9, background: PURPLE, color: "#fff", border: "none", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}
