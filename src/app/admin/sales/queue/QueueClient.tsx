"use client";

import Link from "next/link";
import { useState } from "react";
import type { QueueItem } from "@/lib/sales-ai/queue-store";

const SHOWN = 5;
const card: React.CSSProperties = { background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 14 };
const chip: React.CSSProperties = { display: "inline-block", fontSize: 10.5, border: "0.5px solid var(--border)", borderRadius: 5, padding: "1px 6px", color: "#185FA5", background: "#F4F8FD", marginLeft: 6, whiteSpace: "nowrap" };
const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2E78F5", color: "#fff", textDecoration: "none", display: "inline-block" };
const secondary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "0.5px solid var(--border)", cursor: "pointer", background: "var(--background)", color: "var(--foreground)" };

/**
 * Today's queue: the opportunities that need a person, each with the facts that
 * put it there. Built once a day from the records, ranked by rules.
 */
export function QueueClient({ day, initial }: { day: string; initial: QueueItem[] }) {
  const [items, setItems] = useState(initial);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(id: string, action: "skip" | "snooze") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch("/api/sales/ai-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, action }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
      else setErr(d.error ?? "Could not update the queue.");
    } catch {
      setErr("Could not reach the server.");
    }
    setBusy(null);
  }

  const visible = all ? items : items.slice(0, SHOWN);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}>Today&apos;s queue</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted-foreground)" }}>
          Open opportunities in New opportunity, Qualified, Meeting, Proposal and Negotiation that need you, ranked by rules. Built from the records on {day}, once a day.
        </p>
      </div>

      {items.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 13 }}><b>Nothing needs you today.</b></p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
            An opportunity appears here when a stage move from the agent&apos;s chat is waiting, the prospect chatted after your last email, a draft is ready, or nothing has been logged for 7 days or more.
          </p>
        </div>
      ) : (
        <>
          {visible.map((i) => (
            <div key={i.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{i.rank}. {i.title}{i.contactName ? <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> · {i.contactName}</span> : null}</p>
                <span style={{ fontSize: 11, color: "#185FA5", background: "#E6F1FB", borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>{i.stageName}</span>
              </div>
              <ul style={{ margin: "8px 0 10px", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
                {i.reasons.map((r) => (
                  <li key={r.code}>{r.text}<span style={chip}>{r.source}</span></li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/admin/sales/opportunities/${i.opportunityId}`} style={primary}>Open opportunity</Link>
                <button type="button" disabled={busy === i.id} onClick={() => void decide(i.id, "snooze")} style={secondary}>Snooze 3 days</button>
                <button type="button" disabled={busy === i.id} onClick={() => void decide(i.id, "skip")} style={secondary}>Skip today</button>
              </div>
            </div>
          ))}
          {items.length > SHOWN && (
            <button type="button" onClick={() => setAll((v) => !v)} style={{ ...secondary, alignSelf: "flex-start" }}>
              {all ? `Show the top ${SHOWN}` : `Show ${items.length - SHOWN} more`}
            </button>
          )}
        </>
      )}
      {err && <p role="status" style={{ margin: 0, fontSize: 12, color: "#A32D2D" }}>{err}</p>}
    </div>
  );
}
