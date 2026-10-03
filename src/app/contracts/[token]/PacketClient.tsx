"use client";

import { useState } from "react";
import type { Packet, PacketDoc } from "@/lib/contracts/packet";

const NAVY = "#0A1A40";
const BLUE = "#2E78F5";

const STATUS_TEXT: Record<string, { label: string; bg: string; fg: string }> = {
  awaiting_countersign: { label: "Signed by you · awaiting iCFO countersignature", bg: "#e6f6ec", fg: "#1a7f43" },
  signed: { label: "Fully executed", bg: "#e6f6ec", fg: "#1a7f43" },
  declined: { label: "Declined", bg: "#fdecec", fg: "#A32D2D" },
  changes_requested: { label: "Changes requested", bg: "#fff4d6", fg: "#8a6500" },
  cancelled: { label: "Withdrawn by sender", bg: "#f1f3f7", fg: "#5a6b87" },
  expired: { label: "Expired", bg: "#f1f3f7", fg: "#5a6b87" },
};

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

export function PacketClient({ token, packet }: { token: string; packet: Packet }) {
  const [docs, setDocs] = useState(packet.documents);
  const [responding, setResponding] = useState<{ id: string; action: "decline" | "changes" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond() {
    if (!responding) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/contracts/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: responding.id, action: responding.action, note }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Something went wrong.");
      return;
    }
    setDocs((d) => d.map((x) => (x.id === responding.id ? { ...x, status: responding.action === "decline" ? "declined" : "changes_requested", signUrl: null } : x)));
    setResponding(null);
    setNote("");
  }

  const count = docs.length;
  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5", fontFamily: "Inter, system-ui, sans-serif", color: NAVY }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "15px 24px", background: NAVY }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          i<span style={{ color: "#4F94FF" }}>CFO</span> <span style={{ fontSize: 12, fontWeight: 400, color: "#9fd0ff", marginLeft: 8 }}>Capital Global, Inc.</span>
        </span>
        <span style={{ fontSize: 12, color: "#9fd0ff" }}>Secure signing · {packet.recipientEmail}</span>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 48px" }}>
        <div style={{ background: "#fff", border: "1px solid #d5deea", borderRadius: 12, padding: "22px 24px" }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Documents for your review</h1>
          <p style={{ fontSize: 13, color: "#5a6b87", margin: "6px 0 0", lineHeight: 1.6 }}>
            {count === 1 ? "One agreement." : `${count} independent agreements. You may sign one, some, or none.`} Nothing is binding until signed.
          </p>

          <div style={{ border: "1px solid #d5deea", borderRadius: 10, marginTop: 16, overflow: "hidden" }}>
            {docs.map((d, i) => (
              <DocRow key={d.id} d={d} token={token} first={i === 0} onRespond={(action) => { setResponding({ id: d.id, action }); setNote(""); setError(null); }} />
            ))}
          </div>

          {responding ? (
            <div style={{ marginTop: 14, padding: 14, background: "#f6f8fc", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                {responding.action === "decline" ? "Decline this document" : "Request changes"} · {docs.find((x) => x.id === responding.id)?.title}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder={responding.action === "decline" ? "Optional: a short reason for the sender" : "What would you like changed?"}
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d5deea", borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: "inherit" }}
              />
              {error ? <p style={{ color: "#A32D2D", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p> : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                <button type="button" onClick={() => setResponding(null)} style={{ border: "1px solid #d5deea", background: "#fff", color: "#3a4a63", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 7, cursor: "pointer" }}>Back</button>
                <button type="button" disabled={busy || (responding.action === "changes" && !note.trim())} onClick={() => void respond()} style={{ border: "none", background: responding.action === "decline" ? "#A32D2D" : BLUE, color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 7, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending…" : responding.action === "decline" ? "Decline" : "Send request"}
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14, padding: "12px 14px", background: "#f6f8fc", borderRadius: 8, fontSize: 12.5, color: "#5a6b87", lineHeight: 1.65 }}>
            Questions before signing? Reply to the email you received, or request changes and the document returns to the sender for revision.
          </div>
        </div>
      </main>
    </div>
  );
}

function DocRow({ d, token, first, onRespond }: { d: PacketDoc; token: string; first: boolean; onRespond: (a: "decline" | "changes") => void }) {
  const left = d.showExpiry ? daysLeft(d.expiresAt) : null;
  const meta = [d.entity, d.pageCount ? `${d.pageCount} pages` : null, d.showExpiry && d.expiresAt ? `expires ${fmtDate(d.expiresAt)}` : null].filter(Boolean).join(" · ");
  const pill = STATUS_TEXT[d.status];
  return (
    <div style={{ padding: "15px 18px", borderTop: first ? "none" : "1px solid #f2f5fa" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <i className="ti ti-file-text" aria-hidden="true" style={{ fontSize: 22, color: "#5a6b87" }} />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{d.title}</div>
          <div style={{ fontSize: 12, color: "#8a93a6", marginTop: 2 }}>
            {meta}
            {left !== null && left >= 0 && d.signUrl ? <span style={{ color: left <= 3 ? "#8a6500" : "#8a93a6" }}> · {left === 0 ? "last day" : `${left} day${left === 1 ? "" : "s"} left`}</span> : null}
          </div>
        </div>
        {d.signUrl ? (
          <a href={d.signUrl} style={{ background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 7, textDecoration: "none" }}>Review and sign</a>
        ) : pill ? (
          <span style={{ background: pill.bg, color: pill.fg, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 12 }}>{pill.label}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, paddingLeft: 36, fontSize: 12.5 }}>
        {d.hasExecuted ? (
          <>
            <a href={`/api/contracts/${token}/file/${d.id}?kind=executed`} style={{ color: BLUE }}>Download executed copy</a>
            <a href={`/api/contracts/${token}/file/${d.id}?kind=certificate`} style={{ color: BLUE }}>Signature certificate</a>
          </>
        ) : (
          <a href={`/api/contracts/${token}/file/${d.id}?kind=sent`} style={{ color: BLUE }}>Download PDF</a>
        )}
        {d.signUrl ? (
          <>
            <button type="button" onClick={() => onRespond("changes")} style={{ background: "none", border: "none", padding: 0, color: "#3a4a63", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>Request changes</button>
            <button type="button" onClick={() => onRespond("decline")} style={{ background: "none", border: "none", padding: 0, color: "#3a4a63", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}>Decline</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
