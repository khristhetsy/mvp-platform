"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SalesAiDraft, SalesAiState } from "@/lib/sales-ai/types";

/**
 * The AI agent tab on an opportunity (admin only). The agent reads everything
 * said on the opportunity, writes an audit with the source of each point, and
 * drafts one email that ends with a question and a link to its chat. A person
 * reviews, edits and sends. Nothing is sent or moved without a click here.
 */

const box: React.CSSProperties = { background: "var(--muted)", borderRadius: 8, padding: 11 };
const label: React.CSSProperties = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", margin: "0 0 6px", fontWeight: 600 };
const input: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box", fontFamily: "inherit" };
const chip: React.CSSProperties = { display: "inline-block", fontSize: 10.5, border: "0.5px solid var(--border)", borderRadius: 5, padding: "1px 6px", color: "#185FA5", background: "#F4F8FD", marginLeft: 6, whiteSpace: "nowrap" };
const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2E78F5", color: "#fff" };
const secondary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "0.5px solid var(--border)", cursor: "pointer", background: "var(--background)", color: "var(--foreground)" };

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function AiAgentPanel({ opportunityId, contactEmail, contactName }: { opportunityId: string; contactEmail: string | null; contactName: string | null }) {
  const router = useRouter();
  const base = `/api/sales/opportunities/${opportunityId}/ai`;
  const [state, setState] = useState<SalesAiState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [includeRefund, setIncludeRefund] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);

  const syncDraft = useCallback((d: SalesAiDraft | null) => {
    setSubject(d?.subject ?? "");
    setBody(d?.body ?? "");
    if (d) setIncludeRefund(d.includeRefundOffer);
    setConfirmSend(false);
  }, []);

  const load = useCallback(async () => {
    const r = await call<SalesAiState>(base);
    if (r.ok) {
      setState(r.data);
      syncDraft(r.data.draft);
    } else setErr(r.error);
  }, [base, syncDraft]);

  useEffect(() => {
    let live = true;
    (async () => {
      // File any stage moves the agent's chats call for, then read the state.
      await call(base, { method: "POST" });
      if (live) await load();
    })();
    return () => { live = false; };
  }, [base, load]);

  async function run<T>(name: string, fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, onOk?: (d: T) => void | Promise<void>) {
    setBusy(name); setErr(null); setOk(null);
    const r = await fn();
    if (r.ok) await onOk?.(r.data); else setErr(r.error);
    setBusy(null);
  }

  const chooseAgent = (agentId: string) => run("agent", () => call(base, json("PUT", { agentId: agentId || null })), load);
  const makeDraft = () => run("draft", () => call<{ draft: SalesAiDraft }>(`${base}/draft`, json("POST", { includeRefundOffer: includeRefund })), (d) => { syncDraft(d.draft); void load(); });

  const toggleRefund = (next: boolean) => {
    setIncludeRefund(next);
    if (!state?.draft) return;
    void run("refund", () => call<{ draft: SalesAiDraft }>(`${base}/draft`, json("PATCH", { draftId: state.draft!.id, includeRefundOffer: next })), (d) => { syncDraft(d.draft); void load(); });
  };

  const saveEdits = () => {
    const d = state?.draft;
    if (!d || (subject === d.subject && body === d.body)) return;
    void run("edit", () => call<{ draft: SalesAiDraft }>(`${base}/draft`, json("PATCH", { draftId: d.id, subject, body })), () => load());
  };

  const discard = () => {
    const d = state?.draft;
    if (!d) return;
    void run("discard", () => call(`${base}/draft`, json("PATCH", { draftId: d.id, status: "discarded" })), async () => { await load(); });
  };

  const send = () => {
    const d = state?.draft;
    if (!d || !contactEmail) return;
    void run("send", async () => {
      // Same route the Send message tab uses, so the send is logged on the timeline as usual.
      const sent = await call<{ ok: boolean }>("/api/sales/chatter/send", json("POST", { via: "icapos", to: contactEmail, toName: contactName, subject, body }));
      if (!sent.ok) return sent;
      return call<{ draft: SalesAiDraft }>(`${base}/draft`, json("PATCH", { draftId: d.id, status: "sent" }));
    }, async () => { setOk(`Sent to ${contactEmail}.`); await load(); router.refresh(); });
  };

  const decide = (suggestionId: string, action: "apply" | "dismiss") =>
    run("suggestion", () => call(`${base}/suggestions`, json("POST", { suggestionId, action })), async () => { await load(); if (action === "apply") router.refresh(); });

  if (!state) return <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{err ?? "Loading the AI agent."}</div>;

  if (!state.stageActive) {
    return (
      <div style={box}>
        <p style={{ margin: 0, fontSize: 12.5 }}>
          The AI agent is off{state.stageName ? ` in ${state.stageName}` : " for this opportunity"}. It works New opportunity, Qualified, Meeting, Proposal and Negotiation while the opportunity is open.
        </p>
      </div>
    );
  }

  const draft = state.draft;
  const agent = state.agents.find((a) => a.id === state.agentId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={label}>Agent for this prospect</p>
        {state.agents.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-foreground)" }}>
            No agents are built yet. <Link href="/admin/ai-agent" style={{ color: "#2E78F5" }}>Build one in AI Agent</Link>.
          </p>
        ) : (
          <>
            <select aria-label="Agent for this prospect" value={state.agentId ?? ""} onChange={(e) => void chooseAgent(e.target.value)} disabled={busy === "agent"} style={input}>
              <option value="">No agent chosen</option>
              {state.agents.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.live}>
                  {a.name} · {a.companyName} · {a.agentType}{a.live ? "" : " (not live)"}
                </option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Chosen once, it stays with this prospect. Only live agents can be chosen, because only a live agent has a chat to link to.{" "}
              <Link href="/admin/ai-agent" style={{ color: "#2E78F5" }}>Build or edit agents</Link>.
            </p>
            {!agent && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#854F0B" }}>No agent chosen, so the email will have no chat link.</p>}
          </>
        )}
      </div>

      {!state.aiConfigured && (
        <p style={{ margin: 0, fontSize: 11.5, color: "#854F0B" }}>The AI reading is not configured here, so the audit uses record facts only and cannot quote the prospect.</p>
      )}

      {!draft ? (
        <div>
          <button type="button" onClick={() => void makeDraft()} disabled={busy !== null} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
            {busy === "draft" ? "Reading the conversation" : "Read the conversation and draft an email"}
          </button>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>A draft only. You review it, and nothing sends until you approve.</p>
        </div>
      ) : (
        <>
          <div style={box}>
            <p style={label}>What the agent read</p>
            <p style={{ margin: "0 0 8px", fontSize: 12 }}>
              {draft.audit.channels.map((c) => `${c.name} ${c.count}`).join(" · ")}
            </p>
            <p style={label}>Audit</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
              {draft.audit.points.map((p, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <b>{p.label}:</b> {p.text}
                  {p.sources.map((s) => <span key={s} style={chip}>{s}</span>)}
                </li>
              ))}
              {draft.audit.notOnFile.length > 0 && <li><b>Not on file:</b> {draft.audit.notOnFile.join(", ")}</li>}
            </ul>
          </div>

          <div>
            <p style={label}>Email to the prospect</p>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 8 }}>
              <input type="checkbox" checked={includeRefund} disabled={busy !== null || !draft.bodyParts} onChange={(e) => toggleRefund(e.target.checked)} />
              <span>Include refund offer{!draft.bodyParts ? " (edited by hand, edit the text instead)" : ""}</span>
            </label>
            <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={saveEdits} style={{ ...input, marginBottom: 6 }} />
            <textarea aria-label="Email body" value={body} onChange={(e) => setBody(e.target.value)} onBlur={saveEdits} rows={14} style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
            {!draft.chatUrl && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#854F0B" }}>No chat link in this draft. Choose a live agent above, then make a new draft.</p>}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!confirmSend ? (
              <button type="button" onClick={() => setConfirmSend(true)} disabled={busy !== null || !contactEmail} style={{ ...primary, opacity: busy || !contactEmail ? 0.5 : 1 }}>Approve and send</button>
            ) : (
              <>
                <button type="button" onClick={send} disabled={busy !== null} style={primary}>{busy === "send" ? "Sending" : `Confirm: send to ${contactEmail}`}</button>
                <button type="button" onClick={() => setConfirmSend(false)} style={secondary}>Back</button>
              </>
            )}
            <button type="button" onClick={() => void makeDraft()} disabled={busy !== null} style={secondary}>Make a new draft</button>
            <button type="button" onClick={discard} disabled={busy !== null} style={secondary}>Discard</button>
          </div>
          {!contactEmail && <p style={{ margin: 0, fontSize: 11.5, color: "#854F0B" }}>This opportunity has no contact email, so it cannot be sent from here.</p>}
        </>
      )}

      {state.suggestions.length > 0 && (
        <div style={box}>
          <p style={label}>Suggested stage move</p>
          {state.suggestions.map((s) => (
            <div key={s.id} style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 6px", fontSize: 12.5 }}><b>Move to {s.toStageName}.</b> {s.reason}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => decide(s.id, "apply")} disabled={busy !== null} style={primary}>Confirm move</button>
                <button type="button" onClick={() => decide(s.id, "dismiss")} disabled={busy !== null} style={secondary}>Keep stage</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(ok || err) && <p role="status" style={{ margin: 0, fontSize: 12, color: err ? "#A32D2D" : "#0F6E56" }}>{err ?? ok}</p>}
    </div>
  );
}
