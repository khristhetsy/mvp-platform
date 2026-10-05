"use client";

// Marketing Hub › Sequences › Partner outreach editor. Four steps: Partners, Offer,
// Steps (with the due now queue), Review. Every send is released by a person here.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApproverPicker } from "../../ApproverPicker";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";
import {
  PARTNER_STEPS, STAGES, TIER_LABEL, TRACK_LABEL, TIER_DEFAULT_TRACK, activationBlockers, emailForStep,
  standardDay1, stageCounts, stageStopsSteps,
  type PartnerConfig, type PartnerSender, type PartnerStage, type PartnerTier, type PartnerTrack, type PartnerRating,
} from "@/lib/marketing/partner-outreach/config";
import type { PartnerSequence, PartnerEnrollment, ContactHit } from "@/lib/marketing/partner-outreach/store";

type Tab = "partners" | "offer" | "steps" | "review";

const BLUE = "#2E78F5";
const card: React.CSSProperties = { background: "#ffffff", border: "0.5px solid #e2e6ed", borderRadius: 12, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" };
const input: React.CSSProperties = { fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff", color: "var(--foreground)", width: "100%" };
const btn: React.CSSProperties = { fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "#fff", cursor: "pointer", color: "var(--foreground)" };
const btnPrimary: React.CSSProperties = { ...btn, border: "none", background: BLUE, color: "#fff" };
const label: React.CSSProperties = { fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 };

const statusColors: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A" }, active: { bg: "#E1F5EE", color: "#0F6E56" },
  paused: { bg: "#FAEEDA", color: "#854F0B" }, archived: { bg: "#FCEBEB", color: "#A32D2D" },
};
const ratingColors: Record<PartnerRating, { bg: string; color: string }> = {
  strong: { bg: "#E1F5EE", color: "#0F6E56" }, check: { bg: "#FAEEDA", color: "#854F0B" },
};

interface Props {
  initial: PartnerSequence | null;
  partners: PartnerEnrollment[];
  canActivate: boolean;
  resendReady: boolean;
  defaults: PartnerSender;
}

export function PartnerSequenceEditor({ initial, partners: initialPartners, canActivate, resendReady, defaults }: Props) {
  const router = useRouter();
  const [seq, setSeq] = useState<PartnerSequence | null>(initial);
  const [partners, setPartners] = useState<PartnerEnrollment[]>(initialPartners);
  const [tab, setTab] = useState<Tab>("partners");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // "Now" for due checks, refreshed on every reload (render stays pure).
  const [now, setNow] = useState(() => Date.now());

  async function reload(id = seq?.id) {
    if (!id) return;
    const res = await fetch(`/api/marketing/partner-sequences/${id}`, { cache: "no-store" });
    if (res.ok) { const d = await res.json(); setSeq(d.sequence); setPartners(d.partners); }
    setNow(Date.now());
  }
  function say(kind: "ok" | "err", text: string) { setMsg({ kind, text }); }

  // ── New sequence ──
  const [newName, setNewName] = useState("Partner outreach · Wave 1");
  const [newDept, setNewDept] = useState("Sales");
  if (!seq) {
    return (
      <div style={{ maxWidth: 640 }}>
        <Link href="/admin/marketing/sequences" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}><i className="ti ti-arrow-left" aria-hidden="true" /> Sequences</Link>
        <div style={{ ...card, padding: "18px 20px", marginTop: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>New partner outreach sequence</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>Recruit referral and resale partners from Contacts. You add partners and set the offer next.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
            <div><label style={label} htmlFor="po-name">Name</label><input id="po-name" style={input} value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><label style={label} htmlFor="po-dept">Department</label>
              <select id="po-dept" style={input} value={newDept} onChange={(e) => setNewDept(e.target.value)}>
                <option value="">Unassigned</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
          </div>
          {msg && <div style={{ fontSize: 12, marginTop: 10, color: msg.kind === "err" ? "#A32D2D" : "#0F6E56" }}>{msg.text}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button type="button" style={btnPrimary} disabled={busy === "create"} onClick={async () => {
              if (!newName.trim()) { say("err", "Enter a name."); return; }
              setBusy("create");
              const res = await fetch("/api/marketing/partner-sequences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, department: newDept || null }) });
              const d = await res.json().catch(() => ({}));
              setBusy(null);
              if (!res.ok) { say("err", d.error ?? "Couldn't create the sequence."); return; }
              router.replace(`/admin/marketing/sequences/partner/${d.id}`);
            }}>{busy === "create" ? "Creating…" : "Create"}</button>
            <Link href="/admin/marketing/sequences" style={{ ...btn, textDecoration: "none" }}>Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  const counts = stageCounts(partners);
  const due = partners.filter((p) => !stageStopsSteps(p.stage) && p.current_step < PARTNER_STEPS.length && p.next_due_at && new Date(p.next_due_at).getTime() <= now);
  const blockers = activationBlockers(seq.config);
  const sc = statusColors[seq.status] ?? statusColors.draft;

  async function setStatus(action: "activate" | "pause" | "archive" | "draft") {
    if (!seq) return;
    setBusy(action);
    const res = await fetch(`/api/marketing/partner-sequences/${seq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { say("err", d.error ?? "Couldn't change the status."); return; }
    say("ok", action === "activate" ? `Activated. ${d.started ?? 0} partners started; their Day 1 emails are due now.` : action === "pause" ? "Paused." : action === "archive" ? "Archived." : "Moved back to draft.");
    await reload(); router.refresh();
  }

  const tabs: Array<{ key: Tab; n: number; label: string; badge?: string }> = [
    { key: "partners", n: 1, label: "Partners", badge: String(partners.length) },
    { key: "offer", n: 2, label: "Offer", badge: blockers.length ? "Set" : undefined },
    { key: "steps", n: 3, label: "Steps", badge: due.length ? `${due.length} due` : undefined },
    { key: "review", n: 4, label: "Review" },
  ];

  return (
    <div>
      <Link href="/admin/marketing/sequences" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}><i className="ti ti-arrow-left" aria-hidden="true" /> Sequences</Link>
      {!resendReady && (
        <div style={{ margin: "10px 0", fontSize: 12, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F0B65E", borderRadius: 8, padding: "9px 12px" }}>
          <b>Email provider not connected.</b> Sends will fail until RESEND_API_KEY is set.
        </div>
      )}

      <div style={{ ...card, padding: "16px 18px", marginTop: 10 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <NameEditor seq={seq} onSaved={(name) => setSeq({ ...seq, name })} />
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#EEF4FF", color: "#185FA5", fontWeight: 500 }}>Partner outreach</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
            Approver <ApproverPicker sequenceId={seq.id} initialApproverId={seq.approver_id} />
          </span>
        </div>

        {/* Pipeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          {STAGES.map((s) => (
            <div key={s.key} style={{ background: "#F5F7FA", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{counts[s.key]}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Step rail */}
        <div role="tablist" style={{ display: "flex", gap: 6, margin: "14px 0 4px", flexWrap: "wrap" }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                  border: on ? `1px solid ${BLUE}` : "0.5px solid var(--border)", background: on ? "#EEF4FF" : "#fff", color: on ? "#185FA5" : "var(--foreground)" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: on ? BLUE : "#E6F1FB", color: on ? "#fff" : "#185FA5", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t.n}</span>
                {t.label}
                {t.badge && <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 10, background: t.key === "offer" ? "#FAEEDA" : "#E6F1FB", color: t.key === "offer" ? "#854F0B" : "#185FA5" }}>{t.badge}</span>}
              </button>
            );
          })}
        </div>

        {msg && <div role="status" style={{ fontSize: 12, margin: "10px 0 0", padding: "8px 12px", borderRadius: 8, background: msg.kind === "err" ? "#FCEBEB" : "#E1F5EE", color: msg.kind === "err" ? "#A32D2D" : "#0F6E56", display: "flex", gap: 8 }}>
          <span style={{ flex: 1 }}>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} aria-label="Dismiss" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}>×</button>
        </div>}

        <div style={{ marginTop: 14 }}>
          {tab === "partners" && <PartnersTab seq={seq} partners={partners} now={now} reload={() => reload()} say={say} />}
          {tab === "offer" && <OfferTab seq={seq} onSaved={(config) => setSeq({ ...seq, config })} say={say} />}
          {tab === "steps" && <StepsTab seq={seq} partners={partners} due={due} reload={() => reload()} say={say} />}
          {tab === "review" && (
            <ReviewTab seq={seq} partners={partners} blockers={blockers} canActivate={canActivate} busy={busy} onStatus={setStatus} say={say} defaults={defaults} />
          )}
        </div>
      </div>
    </div>
  );
}

function NameEditor({ seq, onSaved }: { seq: PartnerSequence; onSaved: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(seq.name);
  if (!editing) return (
    <button type="button" onClick={() => setEditing(true)} title="Rename" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>
      {seq.name} <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "var(--muted-foreground)" }} />
    </button>
  );
  return (
    <span style={{ display: "flex", gap: 6 }}>
      <input aria-label="Sequence name" style={{ ...input, width: 280 }} value={name} onChange={(e) => setName(e.target.value)} />
      <button type="button" style={btnPrimary} onClick={async () => {
        if (!name.trim()) return;
        const res = await fetch(`/api/marketing/partner-sequences/${seq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
        if (res.ok) { onSaved(name.trim()); setEditing(false); }
      }}>Save</button>
      <button type="button" style={btn} onClick={() => { setName(seq.name); setEditing(false); }}>Cancel</button>
    </span>
  );
}

// ── 1 Partners ──────────────────────────────────────────────────────────────

function nextStepLabel(p: PartnerEnrollment, now: number): string {
  if (p.stage !== "enrolled") return STAGES.find((s) => s.key === p.stage)?.label ?? p.stage;
  const step = PARTNER_STEPS[p.current_step];
  if (!step) return "All steps done";
  if (!p.next_due_at) return `${step.label} · starts when active`;
  const d = new Date(p.next_due_at);
  return d.getTime() <= now ? `${step.label} · due now` : `${step.label} · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// Tier filter: one dropdown with live counts, replacing the old chip row.
function TierDropdown({ value, total, byTier, onChange }: { value: 0 | PartnerTier; total: number; byTier: Record<number, number>; onChange: (t: 0 | PartnerTier) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const active = value !== 0;
  const label = active ? TIER_LABEL[value] : "All tiers";
  const count = active ? byTier[value] : total;
  const pill = (on: boolean): React.CSSProperties => ({ fontSize: 11.5, fontVariantNumeric: "tabular-nums", borderRadius: 20, padding: "1px 8px", background: on ? "#DBE6FF" : "#F1F3F6", color: on ? "#185FA5" : "var(--muted-foreground)" });
  const option = (t: 0 | PartnerTier) => {
    const on = value === t;
    const [head, sub] = t === 0 ? ["All tiers", ""] : TIER_LABEL[t].split(" · ");
    return (
      <button key={t} type="button" role="option" aria-selected={on} onClick={() => { onChange(t); setOpen(false); }}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: 0, cursor: "pointer", background: on ? "#EEF4FF" : "transparent", color: "var(--foreground)", fontSize: 13 }}
        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#F5F7FA"; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
        <span style={{ width: 14, color: BLUE, fontWeight: 600 }}>{on ? "✓" : ""}</span>
        <span style={{ flex: 1 }}>{head}{sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--muted-foreground)" }}>{sub}</span>}</span>
        <span style={pill(on)}>{t === 0 ? total : byTier[t]}</span>
      </button>
    );
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label="Tier" onClick={() => setOpen(!open)}
        style={{ ...input, width: "auto", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", whiteSpace: "nowrap", ...(active || open ? { border: `1px solid ${BLUE}`, background: "#EEF4FF", color: "#185FA5" } : {}) }}>
        {label}
        <span style={pill(active || open)}>{count}</span>
        <i className="ti ti-chevron-down" aria-hidden="true" style={{ fontSize: 13, opacity: 0.7 }} />
      </button>
      {open && (
        <div role="listbox" aria-label="Tier" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, width: 300, background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 10, boxShadow: "0 12px 30px rgba(17,24,39,.12)", padding: 6 }}>
          {option(0)}
          <div style={{ height: 1, background: "#e2e6ed", margin: "4px 6px" }} />
          {([1, 2, 3, 4] as PartnerTier[]).map((t) => option(t))}
        </div>
      )}
    </div>
  );
}

function PartnersTab({ seq, partners, now, reload, say }: { seq: PartnerSequence; partners: PartnerEnrollment[]; now: number; reload: () => Promise<void>; say: (k: "ok" | "err", t: string) => void }) {
  const [tierFilter, setTierFilter] = useState<0 | PartnerTier>(0);
  const [ratingFilter, setRatingFilter] = useState<"" | PartnerRating>("");
  const [stageFilter, setStageFilter] = useState<"" | PartnerStage>("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const byTier = useMemo(() => {
    const m: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of partners) m[p.tier]++;
    return m;
  }, [partners]);
  const q = query.trim().toLowerCase();
  const rows = partners.filter((p) => (!tierFilter || p.tier === tierFilter) && (!ratingFilter || p.rating === ratingFilter) && (!stageFilter || p.stage === stageFilter)
    && (!q || `${p.name} ${p.firm ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)));
  const noEmail = partners.filter((p) => !p.email).length;

  async function patch(id: string, body: Record<string, unknown>, okText?: string) {
    const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/partners`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollment_id: id, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { say("err", d.error ?? "Couldn't save."); return false; }
    if (okText) say("ok", okText);
    await reload();
    return true;
  }

  const chip = (on: boolean): React.CSSProperties => ({ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", border: on ? `1px solid ${BLUE}` : "0.5px solid var(--border)", background: on ? "#EEF4FF" : "#fff", color: on ? "#185FA5" : "var(--foreground)" });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <TierDropdown value={tierFilter} total={partners.length} byTier={byTier} onChange={setTierFilter} />
        <select aria-label="Rating" style={{ ...input, width: "auto", fontSize: 12 }} value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value as "" | PartnerRating)}>
          <option value="">Any rating</option><option value="strong">Strong</option><option value="check">Check</option>
        </select>
        <select aria-label="Stage" style={{ ...input, width: "auto", fontSize: 12 }} value={stageFilter} onChange={(e) => setStageFilter(e.target.value as "" | PartnerStage)}>
          <option value="">Any stage</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input aria-label="Search partners" placeholder="Search partners…" style={{ ...input, width: 200 }} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" style={{ ...btnPrimary, marginLeft: "auto" }} onClick={() => setAdding(!adding)}><i className="ti ti-plus" aria-hidden="true" /> Add partners</button>
      </div>

      {adding && <AddPartners seq={seq} onAdded={async (text) => { say("ok", text); await reload(); }} say={say} />}

      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 6 }}>
        {tierFilter !== 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 8 }}>
            <span style={{ ...chip(true), cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
              Tier {tierFilter}
              <button type="button" aria-label="Clear tier filter" onClick={() => setTierFilter(0)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
            Showing {rows.length} of {partners.length} partners ·
          </span>
        )}
        {partners.length} partners · {partners.length - noEmail} with email{noEmail ? ` · ${noEmail} without email (their emails get skipped, the call task still runs)` : ""}
      </div>

      <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1.4fr 70px 120px 1.3fr 34px", gap: 8, padding: "8px 12px", background: "#F5F7FA", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Partner</span><span>Firm</span><span>Email</span><span>Rating</span><span>Stage</span><span>Next step</span><span />
        </div>
        {rows.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>{partners.length ? "No partners match these filters." : "Add partners from Contacts to start."}</div>}
        {rows.map((p) => {
          const open = openId === p.id;
          const rc = ratingColors[p.rating];
          return (
            <div key={p.id} style={{ borderTop: "0.5px solid #eef1f5" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1.4fr 70px 120px 1.3fr 34px", gap: 8, padding: "8px 12px", alignItems: "center", fontSize: 12.5, background: open ? "#F5F9FF" : undefined }}>
                <button type="button" onClick={() => setOpenId(open ? null : p.id)} style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", color: "var(--foreground)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}{p.subject ? <i className="ti ti-pencil" title="Personal Day 1 email" aria-label="Personal Day 1 email" style={{ fontSize: 12, color: BLUE, marginLeft: 4 }} /> : null}
                </button>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>{p.firm ?? ""}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.email ? "var(--foreground)" : "#854F0B" }}>{p.email ?? "No email"}</span>
                <span><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: rc.bg, color: rc.color }}>{p.rating === "strong" ? "Strong" : "Check"}</span></span>
                <select aria-label={`Stage for ${p.name}`} value={p.stage} onChange={(e) => void patch(p.id, { stage: e.target.value }, `${p.name}: ${STAGES.find((s) => s.key === e.target.value)?.label}.`)} style={{ ...input, fontSize: 12, padding: "4px 6px" }}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{nextStepLabel(p, now)}</span>
                <button type="button" aria-label={open ? "Close" : "Open"} onClick={() => setOpenId(open ? null : p.id)} style={{ border: "0.5px solid var(--border)", background: "#fff", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: "#185FA5" }}><i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" /></button>
              </div>
              {open && <PartnerDetail seq={seq} p={p} patch={patch} reload={reload} say={say} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PartnerDetail({ seq, p, patch, reload, say }: { seq: PartnerSequence; p: PartnerEnrollment; patch: (id: string, body: Record<string, unknown>, ok?: string) => Promise<boolean>; reload: () => Promise<void>; say: (k: "ok" | "err", t: string) => void }) {
  const std = standardDay1(p);
  const [subject, setSubject] = useState(p.subject ?? "");
  const [body, setBody] = useState(p.body ?? "");
  const [email, setEmail] = useState(p.email ?? "");
  const [tier, setTier] = useState<PartnerTier>(p.tier);
  const [track, setTrack] = useState<PartnerTrack>(p.track);
  const [rating, setRating] = useState<PartnerRating>(p.rating);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div style={{ padding: "4px 12px 14px", background: "#F5F9FF", display: "grid", gap: 10 }}>
      {p.evidence && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}><b style={{ fontWeight: 500, color: "var(--foreground)" }}>Why this partner:</b> {p.evidence}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 110px", gap: 8 }}>
        <div><label style={label}>Email</label><input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firm.com" /></div>
        <div><label style={label}>Tier</label><select style={input} value={tier} onChange={(e) => { const t = Number(e.target.value) as PartnerTier; setTier(t); setTrack(TIER_DEFAULT_TRACK[t]); }}>{([1, 2, 3, 4] as PartnerTier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select></div>
        <div><label style={label}>Track</label><select style={input} value={track} onChange={(e) => setTrack(e.target.value as PartnerTrack)}>{(Object.keys(TRACK_LABEL) as PartnerTrack[]).map((k) => <option key={k} value={k}>{TRACK_LABEL[k]}</option>)}</select></div>
        <div><label style={label}>Rating</label><select style={input} value={rating} onChange={(e) => setRating(e.target.value as PartnerRating)}><option value="strong">Strong</option><option value="check">Check</option></select></div>
      </div>
      <div>
        <label style={label}>Day 1 subject {p.subject ? "(personal)" : "(empty uses the standard email)"}</label>
        <input style={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={std.subject} />
      </div>
      <div>
        <label style={label}>Day 1 email</label>
        <textarea style={{ ...input, minHeight: 180, fontFamily: "inherit", lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder={std.body} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btnPrimary} onClick={() => void patch(p.id, {
          subject: subject.trim() || null, body: body.trim() || null, email: email.trim() || null, tier, track, rating,
        }, `${p.name} saved.`)}>Save</button>
        {(subject || body) && <button type="button" style={btn} onClick={() => { setSubject(""); setBody(""); }}>Use the standard email</button>}
        {!confirmRemove
          ? <button type="button" style={{ ...btn, color: "#A32D2D", borderColor: "#F7C1C1", marginLeft: "auto" }} onClick={() => setConfirmRemove(true)}>Remove from sequence</button>
          : <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>Remove {p.name}?
              <button type="button" style={{ ...btn, background: "#A32D2D", color: "#fff", border: "none" }} onClick={async () => {
                const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/partners?enrollment_id=${p.id}`, { method: "DELETE" });
                if (res.ok) { say("ok", `${p.name} removed.`); await reload(); } else say("err", "Couldn't remove.");
              }}>Remove</button>
              <button type="button" style={btn} onClick={() => setConfirmRemove(false)}>Keep</button>
            </span>}
      </div>
      {p.history?.length > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
          {p.history.slice().reverse().map((h, i) => (
            <div key={i}>{new Date(h.at).toLocaleString()} · {PARTNER_STEPS.find((s) => s.key === h.step)?.label ?? h.step} · {h.result}{h.error ? ` (${h.error})` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPartners({ seq, onAdded, say }: { seq: PartnerSequence; onAdded: (text: string) => Promise<void>; say: (k: "ok" | "err", t: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [picked, setPicked] = useState<Record<string, ContactHit>>({});
  const [tier, setTier] = useState<PartnerTier>(1);
  const [track, setTrack] = useState<PartnerTrack>("advisor");
  const [rating, setRating] = useState<PartnerRating>("strong");
  const [searching, setSearching] = useState(false);

  async function search() {
    if (q.trim().length < 2) { say("err", "Type at least 2 characters."); return; }
    setSearching(true);
    const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/partners?q=${encodeURIComponent(q)}`);
    const d = await res.json().catch(() => ({ contacts: [] }));
    setHits(d.contacts ?? []); setSearching(false);
  }
  async function add() {
    const list = Object.values(picked);
    if (!list.length) { say("err", "Pick at least one contact."); return; }
    const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/partners`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partners: list.map((c) => ({ crm_contact_id: c.id, name: c.name, firm: c.company, email: c.email, phone: c.phone, tier, track, rating })) }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { say("err", d.error ?? "Couldn't add partners."); return; }
    setPicked({}); setHits([]); setQ("");
    await onAdded(`Added ${d.added}${d.skipped ? `, skipped ${d.skipped} already in this sequence` : ""}.`);
  }

  return (
    <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: 12, marginBottom: 10, background: "#FAFCFF" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input aria-label="Search Contacts" style={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} placeholder="Search Contacts by name, firm or email" />
        <button type="button" style={btn} onClick={() => void search()}>{searching ? "Searching…" : "Search"}</button>
      </div>
      {hits.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {hits.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <input type="checkbox" checked={!!picked[c.id]} onChange={(e) => setPicked((m) => { const n = { ...m }; if (e.target.checked) n[c.id] = c; else delete n[c.id]; return n; })} />
              <span style={{ fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: "var(--muted-foreground)" }}>{c.company && c.company !== c.name ? c.company : ""} {c.email ?? "· no email"}</span>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div><label style={label}>Tier</label><select style={{ ...input, width: "auto" }} value={tier} onChange={(e) => { const t = Number(e.target.value) as PartnerTier; setTier(t); setTrack(TIER_DEFAULT_TRACK[t]); }}>{([1, 2, 3, 4] as PartnerTier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select></div>
        <div><label style={label}>Track</label><select style={{ ...input, width: "auto" }} value={track} onChange={(e) => setTrack(e.target.value as PartnerTrack)}>{(Object.keys(TRACK_LABEL) as PartnerTrack[]).map((k) => <option key={k} value={k}>{TRACK_LABEL[k]}</option>)}</select></div>
        <div><label style={label}>Rating</label><select style={{ ...input, width: "auto" }} value={rating} onChange={(e) => setRating(e.target.value as PartnerRating)}><option value="strong">Strong</option><option value="check">Check</option></select></div>
        <button type="button" style={btnPrimary} onClick={() => void add()}>Add {Object.keys(picked).length || ""} selected</button>
      </div>
    </div>
  );
}

// ── 2 Offer ─────────────────────────────────────────────────────────────────

function OfferTab({ seq, onSaved, say }: { seq: PartnerSequence; onSaved: (c: PartnerConfig) => void; say: (k: "ok" | "err", t: string) => void }) {
  const [share, setShare] = useState(seq.config.offer.share_pct?.toString() ?? "");
  const [wl, setWl] = useState(seq.config.offer.white_label_price ?? "");
  const [fee, setFee] = useState(seq.config.offer.spv_fee?.toString() ?? "");
  const [counsel, setCounsel] = useState(seq.config.offer.counsel_signed_off);
  const [fromName, setFromName] = useState(seq.config.sender.from_name);
  const [fromEmail, setFromEmail] = useState(seq.config.sender.from_email);
  const [replyTo, setReplyTo] = useState(seq.config.sender.reply_to);
  const [saving, setSaving] = useState(false);

  const num = (s: string) => { const n = Number(s.replace(/[$,%\s]/g, "")); return s.trim() && Number.isFinite(n) ? n : null; };
  const draft: PartnerConfig = {
    offer: { share_pct: num(share), white_label_price: wl.trim() || null, spv_fee: num(fee), counsel_signed_off: counsel },
    sender: { from_name: fromName.trim() || "Khris Thetsy", from_email: fromEmail.trim(), reply_to: replyTo.trim() },
  };
  const blockers = activationBlockers(draft);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>These rates go into the Day 10 rate sheet. Partner pay attaches to subscriptions, resale or a signed engagement, never to capital raised.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <div><label style={label} htmlFor="po-share">Subscription share, %</label><input id="po-share" style={input} inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} placeholder="Percent of each referred subscription" /></div>
        <div><label style={label} htmlFor="po-wl">White label price</label><input id="po-wl" style={input} value={wl} onChange={(e) => setWl(e.target.value)} placeholder="Price per seat per month" /></div>
        <div><label style={label} htmlFor="po-fee">SPV referral fee, flat $</label><input id="po-fee" style={input} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Paid when an engagement signs" /></div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
        <input type="checkbox" checked={counsel} onChange={(e) => setCounsel(e.target.checked)} /> Securities counsel signed off on the SPV referral fee
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <div><label style={label} htmlFor="po-fn">From name</label><input id="po-fn" style={input} value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
        <div><label style={label} htmlFor="po-fe">From email</label><input id="po-fe" style={input} value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></div>
        <div><label style={label} htmlFor="po-rt">Reply to</label><input id="po-rt" style={input} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></div>
      </div>
      {blockers.length > 0 && <div style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", borderRadius: 8, padding: "8px 12px" }}>Before activating: {blockers.join(" ")}</div>}
      <div><button type="button" style={btnPrimary} disabled={saving} onClick={async () => {
        setSaving(true);
        const res = await fetch(`/api/marketing/partner-sequences/${seq.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: draft }) });
        const d = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) { say("err", d.error ?? "Couldn't save the offer."); return; }
        onSaved(draft); say("ok", "Offer saved.");
      }}>{saving ? "Saving…" : "Save offer"}</button></div>
    </div>
  );
}

// ── 3 Steps ─────────────────────────────────────────────────────────────────

function StepsTab({ seq, partners, due, reload, say }: { seq: PartnerSequence; partners: PartnerEnrollment[]; due: PartnerEnrollment[]; reload: () => Promise<void>; say: (k: "ok" | "err", t: string) => void }) {
  const [previewId, setPreviewId] = useState(partners[0]?.id ?? "");
  const [running, setRunning] = useState<string | null>(null);
  const preview = partners.find((p) => p.id === previewId) ?? partners[0];

  async function run(p: PartnerEnrollment, action: "send" | "done" | "skip") {
    setRunning(p.id + action);
    const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollment_id: p.id, action }) });
    const d = await res.json().catch(() => ({}));
    setRunning(null);
    say(res.ok ? "ok" : "err", `${p.name}: ${d.message ?? d.error ?? "Done."}`);
    await reload();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Due now {due.length ? `(${due.length})` : ""}</div>
        {seq.status !== "active" ? (
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Nothing is due until the sequence is activated in Review.</div>
        ) : due.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>Nothing due. The next steps show on each partner in Partners.</div>
        ) : (
          <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden" }}>
            {due.map((p) => {
              const step = PARTNER_STEPS[p.current_step];
              const isEmail = step.channel === "email";
              return (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr auto", gap: 8, alignItems: "center", padding: "8px 12px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                  <span><b style={{ fontWeight: 500 }}>{p.name}</b> <span style={{ color: "var(--muted-foreground)" }}>{p.firm && p.firm !== p.name ? p.firm : ""}</span></span>
                  <span style={{ color: "var(--muted-foreground)" }}>
                    <i className={`ti ${isEmail ? "ti-mail" : "ti-phone"}`} aria-hidden="true" /> {step.label}
                    {isEmail && !p.email ? " · no email, skip it" : ""}{!isEmail && p.phone ? ` · ${p.phone}` : ""}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {isEmail
                      ? <button type="button" style={btnPrimary} disabled={!!running || !p.email} onClick={() => void run(p, "send")}>{running === p.id + "send" ? "Sending…" : "Send"}</button>
                      : <button type="button" style={btnPrimary} disabled={!!running} onClick={() => void run(p, "done")}>Mark done</button>}
                    <button type="button" style={btn} disabled={!!running} onClick={() => void run(p, "skip")}>Skip</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>The four steps</span>
          {partners.length > 0 && <>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: "auto" }}>Preview for</span>
            <select aria-label="Preview partner" style={{ ...input, width: 260 }} value={preview?.id ?? ""} onChange={(e) => setPreviewId(e.target.value)}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.firm && p.firm !== p.name ? ` · ${p.firm}` : ""}</option>)}
            </select>
          </>}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {PARTNER_STEPS.map((s, i) => {
            const mail = preview ? emailForStep(i, preview, seq.config.offer) : null;
            return (
              <details key={s.key} style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "8px 12px", background: "#fff" }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5 }}>
                  <i className={`ti ${s.channel === "email" ? "ti-mail" : "ti-phone"}`} aria-hidden="true" /> <b style={{ fontWeight: 500 }}>{s.label}</b>
                  <span style={{ color: "var(--muted-foreground)" }}>{s.channel === "task" ? " · task for the owner, no email" : mail ? ` · ${mail.subject}` : ""}</span>
                </summary>
                {mail && <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.55, margin: "10px 0 2px", color: "var(--foreground)" }}>{mail.body}</pre>}
                {s.channel === "task" && <div style={{ fontSize: 12.5, marginTop: 8, color: "var(--muted-foreground)" }}>Connect on LinkedIn or call. Mark it done from Due now.</div>}
              </details>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>A partner stops getting steps when you set their stage to Replied, Call booked, Pilot, Signed or Stopped, or when they unsubscribe.</div>
      </div>
    </div>
  );
}

// ── 4 Review ────────────────────────────────────────────────────────────────

function ReviewTab({ seq, partners, blockers, canActivate, busy, onStatus, say, defaults }: {
  seq: PartnerSequence; partners: PartnerEnrollment[]; blockers: string[]; canActivate: boolean; busy: string | null;
  onStatus: (a: "activate" | "pause" | "archive" | "draft") => Promise<void>; say: (k: "ok" | "err", t: string) => void; defaults: PartnerSender;
}) {
  const [testTo, setTestTo] = useState(defaults.reply_to || "");
  const [testPartner, setTestPartner] = useState(partners[0]?.id ?? "");
  const [testing, setTesting] = useState(false);
  const withEmail = partners.filter((p) => p.email).length;
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      <div style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
        <div>{partners.length} partners · {withEmail} with email · {partners.length - withEmail} get call tasks only</div>
        <div>Sender: {seq.config.sender.from_name} &lt;{seq.config.sender.from_email}&gt; · replies to {seq.config.sender.reply_to || "the sender"}</div>
        <div>Every email is sent by a person from Steps › Due now. Nothing sends on its own.</div>
      </div>

      <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Send a test</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select aria-label="Partner to test" style={{ ...input, width: 240 }} value={testPartner} onChange={(e) => setTestPartner(e.target.value)}>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input aria-label="Test address" style={{ ...input, width: 240 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@icapos.com" />
          <button type="button" style={btn} disabled={testing || !testPartner} onClick={async () => {
            setTesting(true);
            const res = await fetch(`/api/marketing/partner-sequences/${seq.id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollment_id: testPartner, email: testTo }) });
            const d = await res.json().catch(() => ({}));
            setTesting(false);
            say(res.ok ? "ok" : "err", res.ok ? `Sent ${d.sent} test emails to ${testTo}${d.failed ? `, ${d.failed} failed` : ""}.` : d.error ?? "Couldn't send the test.");
          }}>{testing ? "Sending…" : "Send the 3 emails to me"}</button>
        </div>
      </div>

      {blockers.length > 0 && <div style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", borderRadius: 8, padding: "8px 12px" }}>Before activating: {blockers.join(" ")}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {seq.status !== "active" && (
          canActivate
            ? <button type="button" style={btnPrimary} disabled={!!busy || blockers.length > 0 || partners.length === 0} onClick={() => void onStatus("activate")}>{busy === "activate" ? "Activating…" : seq.status === "paused" ? "Resume" : "Activate"}</button>
            : <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>The approver activates this sequence once it is ready.</span>
        )}
        {seq.status === "active" && <button type="button" style={btn} disabled={!!busy} onClick={() => void onStatus("pause")}>Pause</button>}
        {seq.status !== "archived" && <button type="button" style={btn} disabled={!!busy} onClick={() => void onStatus("archive")}>Archive</button>}
        {seq.status === "archived" && <button type="button" style={btn} disabled={!!busy} onClick={() => void onStatus("draft")}>Restore to draft</button>}
      </div>
    </div>
  );
}
