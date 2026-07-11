"use client";

import Link from "next/link";
import { useState } from "react";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
interface ScheduleItem { id: string; week_start: string; topic: string; audience: string; platform: string; scheduled_date: string | null; status: string }
interface CampaignResult { id: string; strategy: string; run_date: string; agent_name: string | null; impressions: number; members_reached: number; positive_replies: number; meetings: number; mr_pct: number | null; pr_pct: number | null; meeting_pct: number | null }
interface Romi { impressions: number; members_reached: number; positive_replies: number; meetings: number; mr_pct: number | null; pr_pct: number | null; meeting_pct: number | null }

const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  draft: { bg: "#F1EFE8", c: "#5F5E5A" }, scheduled: { bg: "#E6F1FB", c: "#185FA5" }, sent: { bg: "#E1F5EE", c: "#0F6E56" },
};
const pctStr = (v: number | null) => (v == null ? "—" : `${v}%`);

export function CampaignsClient({ initialSchedule, initialResults, initialRomi }: { initialSchedule: ScheduleItem[]; initialResults: CampaignResult[]; initialRomi: Romi }) {
  const [tab, setTab] = useState<"schedule" | "results">("schedule");
  const [schedule, setSchedule] = useState(initialSchedule);
  const [results, setResults] = useState(initialResults);
  const [romi, setRomi] = useState(initialRomi);
  const [showNew, setShowNew] = useState(false);

  const reloadResults = async () => {
    const d = await fetch("/api/admin/meetings/campaigns/results").then((r) => r.json()).catch(() => null);
    if (d) { setResults(d.results ?? []); setRomi(d.romi ?? romi); }
  };
  const reloadSchedule = async () => {
    const d = await fetch("/api/admin/meetings/campaigns/schedule").then((r) => r.json()).catch(() => null);
    if (d) setSchedule(d.schedule ?? []);
  };
  const setStatus = async (id: string, status: string) => {
    setSchedule((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
    await fetch("/api/admin/meetings/campaigns/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => {});
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>Campaigns & ROMI</h1>
        <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Email schedule and campaign outcomes with computed conversion rates.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <RomiTile label="Impressions" value={romi.impressions.toLocaleString()} />
        <RomiTile label="Members reached" value={romi.members_reached.toLocaleString()} sub={`MR ${pctStr(romi.mr_pct)}`} />
        <RomiTile label="Positive replies" value={romi.positive_replies.toLocaleString()} sub={`PR ${pctStr(romi.pr_pct)}`} />
        <RomiTile label="Meetings" value={romi.meetings.toLocaleString()} sub={`Meeting ${pctStr(romi.meeting_pct)}`} />
      </div>

      <div style={{ display: "flex", gap: 14, borderBottom: "0.5px solid var(--border)", marginBottom: 16 }}>
        {(["schedule", "results"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ paddingBottom: 8, fontSize: 12.5, background: "none", border: "none", cursor: "pointer", textTransform: "capitalize", color: tab === t ? BLUE : MUTED, fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? `2px solid ${BLUE}` : "2px solid transparent" }}>{t === "schedule" ? "Email Schedule" : "Campaign Results"}</button>
        ))}
      </div>

      {tab === "schedule" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Schedule email</button>
          </div>
          {schedule.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No scheduled emails yet.</p> : (
            <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr 1fr 0.8fr 0.9fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", color: MUTED }}>
                <div>Week</div><div>Topic</div><div>Audience</div><div>Platform</div><div>Status</div>
              </div>
              {schedule.map((s) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.6fr 1fr 0.8fr 0.9fr", padding: "9px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", fontSize: 12.5 }}>
                  <div style={{ color: MUTED }}>{s.week_start}</div>
                  <div style={{ color: NAVY }}>{s.topic}</div>
                  <div style={{ color: MUTED }}>{s.audience}</div>
                  <div style={{ color: MUTED, textTransform: "capitalize" }}>{s.platform}</div>
                  <div>
                    <select value={s.status} onChange={(e) => void setStatus(s.id, e.target.value)} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: (STATUS_TONE[s.status] ?? STATUS_TONE.draft).bg, color: (STATUS_TONE[s.status] ?? STATUS_TONE.draft).c }}>
                      <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ResultsTab results={results} onCreated={reloadResults} />
      )}

      {showNew && <NewScheduleModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reloadSchedule(); }} />}
    </div>
  );
}

function RomiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 11, padding: "11px 14px" }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: BLUE, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function ResultsTab({ results, onCreated }: { results: CampaignResult[]; onCreated: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setShow(true)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>+ Log campaign</button>
      </div>
      {results.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No campaign results logged yet.</p> : (
        <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr repeat(6, 0.7fr)", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", color: MUTED, minWidth: 720 }}>
            <div>Strategy</div><div>Date</div><div>Impr.</div><div>Reached</div><div>MR%</div><div>Replies</div><div>PR%</div><div>Meetings</div>
          </div>
          {results.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr repeat(6, 0.7fr)", padding: "9px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 720 }}>
              <div style={{ color: NAVY }}>{r.strategy}</div>
              <div style={{ color: MUTED }}>{r.run_date}</div>
              <div>{r.impressions.toLocaleString()}</div>
              <div>{r.members_reached.toLocaleString()}</div>
              <div style={{ color: "#185FA5" }}>{pctStr(r.mr_pct)}</div>
              <div>{r.positive_replies.toLocaleString()}</div>
              <div style={{ color: "#185FA5" }}>{pctStr(r.pr_pct)}</div>
              <div style={{ color: "#0F6E56" }}>{r.meetings} <span style={{ color: MUTED }}>({pctStr(r.meeting_pct)})</span></div>
            </div>
          ))}
        </div>
      )}
      {show && <NewResultModal onClose={() => setShow(false)} onCreated={() => { setShow(false); onCreated(); }} />}
    </div>
  );
}

const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", marginTop: 4 };
function modalWrap(onClose: () => void, children: React.ReactNode) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ width: "min(440px, 94vw)", background: "#fff", borderRadius: 12, padding: 20 }}>{children}</div>
    </div>
  );
}

function NewScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [week, setWeek] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("Investors");
  const [platform, setPlatform] = useState("resend");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!week || !topic.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/campaigns/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week_start: week, topic: topic.trim(), audience, platform }) });
      if (r.ok) onCreated();
    } finally { setBusy(false); }
  };
  return modalWrap(onClose, (
    <>
      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 12 }}>Schedule email</div>
      <label style={{ fontSize: 10.5, color: MUTED }}>Week starting<input type="date" value={week} onChange={(e) => setWeek(e.target.value)} style={field} /></label>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" style={field} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={audience} onChange={(e) => setAudience(e.target.value)} style={field}><option>Investors</option><option>Entrepreneurs</option><option>Registrants</option></select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={field}><option value="resend">Resend</option><option value="sendgrid">SendGrid</option></select>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => void create()} disabled={busy || !week || !topic.trim()} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Adding…" : "Add"}</button>
        <button onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
      </div>
    </>
  ));
}

function NewResultModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [strategy, setStrategy] = useState("");
  const [runDate, setRunDate] = useState("");
  const [nums, setNums] = useState({ impressions: "", members_reached: "", positive_replies: "", meetings: "" });
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!strategy.trim() || !runDate) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/meetings/campaigns/results", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: strategy.trim(), run_date: runDate, impressions: Number(nums.impressions) || 0, members_reached: Number(nums.members_reached) || 0, positive_replies: Number(nums.positive_replies) || 0, meetings: Number(nums.meetings) || 0 }),
      });
      if (r.ok) onCreated();
    } finally { setBusy(false); }
  };
  const numField = (k: keyof typeof nums, label: string) => (
    <label style={{ fontSize: 10.5, color: MUTED }}>{label}<input type="number" min="0" value={nums[k]} onChange={(e) => setNums((p) => ({ ...p, [k]: e.target.value }))} style={field} /></label>
  );
  return modalWrap(onClose, (
    <>
      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 12 }}>Log campaign result</div>
      <input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="Strategy (e.g. Posting Campaign E071426)" style={field} />
      <label style={{ fontSize: 10.5, color: MUTED }}>Run date<input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} style={field} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {numField("impressions", "Impressions")}{numField("members_reached", "Members reached")}
        {numField("positive_replies", "Positive replies")}{numField("meetings", "Meetings")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => void create()} disabled={busy || !strategy.trim() || !runDate} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>{busy ? "Saving…" : "Save"}</button>
        <button onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, background: "#F1EFE8", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
      </div>
    </>
  ));
}
