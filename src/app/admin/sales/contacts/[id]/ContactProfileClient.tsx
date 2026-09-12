"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { groupContactProfile } from "@/lib/sales/contact-profile-sections";
import { parseMoneyBand } from "@/lib/investors/preference-match";
import { CompanyLinkedRecordEditor } from "./CompanyLinkedRecordEditor";
import { RatingRing } from "@/components/investor-rating/RatingRing";
import { SalesChatter } from "@/components/sales/SalesChatter";

type Contact = {
  id: string; source: string; name: string; email: string | null; company: string | null; phone: string | null; phone2: string | null;
  website: string | null; lead_status: string | null; lead_source: string | null; tags: string[]; owner: string | null; owner_id: string | null; assignee_ids: string[]; membership: string | null;
  job_position: string | null; street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null;
  country: string | null; language: string | null; created_on: string | null; note: string | null;
  extra: Array<{ label: string; values: string[] }>;
  /** sourceKey → rule id for values this platform derived rather than was told. */
  derivedSources?: Record<string, string>;
};
type LinkedOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; probability: number | null; status: string };
type Staff = { id: string; name: string };
type Activity = { id: string; kind: string; summary: string; actor_name: string | null; created_at: string };
type OdooMsg = { id: number; date: string | null; author: string | null; subject: string | null; body: string; type: string | null; isNote?: boolean };
type BookingLite = { id: string; event_type: string | null; start_time: string; end_time: string; timezone: string | null; meet_url: string | null; status: string; answers: { label: string; value: string }[]; booker_phone: string | null };
const LEAD_STATUSES = ["new", "contacted", "qualified", "paused", "not interested", "won", "lost"];
// Profile fields that must always be a plain text box, never a select dropdown —
// even when Odoo reports selection options for them. These are free-form by
// nature (a written note, a referral name, a management-team description).
const FREE_TEXT_FIELD_LABELS = new Set(["Note", "Request", "Quick notes", "Pitch frame to use", "If other, referred you", "Investor business summary", "Investor short bio", "Investor special skills", "Investor work experience", "Short bio", "Special skills", "Work experience", "Business summary", "Management team"]);
// A value that is a URL (the Social section, a website in Other details) renders as a
// link rather than a chip. Detected from the value, not the label, so it works for any
// synced field. Requires an alphabetic TLD so numbers like "1.5" aren't caught.
const URLISH = /^(https?:\/\/\S+|(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?)$/i;
const hrefOf = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
// Fields that hold exactly one value (a range/band) — the picker is single-select.
const SINGLE_SELECT_FIELD_LABELS = new Set(["ARR", "MRR"]);

// Standard investor investment-size bands, smallest → largest. Used to derive
// "all bands up to the Reg D raised" for SEC Form D-only investors.
const INVESTMENT_SIZE_BANDS = ["Less than $50k", "$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $1m", "$1m - $10m", "$10m - $50m", "$50m - $100m", "$100m+"];
// Curated option lists for the structured contact fields (rendered as dropdowns).
// Any existing/legacy value that isn't in a list is preserved and pinned on top.
const MEMBERSHIP_OPTS = ["Entrepreneur", "Investor", "Both", "Prospect", "None"];
const JOB_POSITION_OPTS = ["CEO", "CFO", "COO", "CTO", "Founder", "Co-founder", "President", "Managing partner", "Managing director", "Partner", "VP", "Director", "Investor", "Advisor", "Other"];
const LEAD_SOURCE_OPTS = ["LinkedIn", "Referral", "Website", "Event", "Conference", "Cold outreach", "Email campaign", "Partner", "Inbound", "Webinar", "Other"];
const ACT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  email: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  contact_edit: { icon: "ti-edit", color: "#5F5E5A", bg: "#F1EFE8" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  converted: { icon: "ti-arrow-right", color: "#185FA5", bg: "#E6F1FB" },
  stage_changed: { icon: "ti-arrow-right", color: "#854F0B", bg: "#FAEEDA" },
  won: { icon: "ti-trophy", color: "#3B6D11", bg: "#EAF3DE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  email_draft: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
};
function actWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
// Responsive field columns: two-up when there's room, collapsing to one column as
// the panel narrows (Odoo-style). minmax floor sets the drop-to-one threshold.
const RESP_COLS = "repeat(auto-fit, minmax(240px, 1fr))";
const RESP_COLS_SM = "repeat(auto-fit, minmax(150px, 1fr))";
// Tags: each name maps to a stable color (same tag → same color everywhere), so no
// per-tag color store is needed. Hash the name into a fixed pastel palette.
const TAG_PALETTE = [
  { bg: "#D5F5E8", fg: "#0F6E56" }, { bg: "#E6F1FB", fg: "#185FA5" },
  { bg: "#FBE7F0", fg: "#993556" }, { bg: "#FAEEDA", fg: "#854F0B" },
  { bg: "#EEEDFE", fg: "#3C3489" }, { bg: "#FCEBEB", fg: "#A32D2D" },
  { bg: "#EAF3DE", fg: "#3B6D11" }, { bg: "#F1EFE8", fg: "#5F5E5A" },
];
function tagColor(name: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}
const outlineBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" };

const LEAD_TONE: Record<string, { bg: string; c: string }> = {
  new: { bg: "#E6F1FB", c: "#185FA5" }, contacted: { bg: "#FAEEDA", c: "#854F0B" },
  qualified: { bg: "#E1F5EE", c: "#0F6E56" }, paused: { bg: "#F1EFE8", c: "#5F5E5A" },
  "not interested": { bg: "#FCEBEB", c: "#A32D2D" }, won: { bg: "#EAF3DE", c: "#3B6D11" }, lost: { bg: "#FCEBEB", c: "#A32D2D" },
};
function StatusPill({ status }: { status: string }) {
  const t = LEAD_TONE[status.toLowerCase()] ?? { bg: "#F1EFE8", c: "#5F5E5A" };
  return <span style={{ fontSize: 11, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 20, padding: "2px 10px", textTransform: "capitalize" }}>{status}</span>;
}
function Chip({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const clickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      style={{
        background: clickable && hover ? "#EEF3FF" : "#F6F8FB",
        border: `1px solid ${clickable && hover ? "#2E78F5" : "transparent"}`,
        borderRadius: 8,
        padding: "9px 12px",
        cursor: clickable ? "pointer" : "default",
        transition: "background .12s, border-color .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
        {clickable && <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 13, color: hover ? "#2E78F5" : "#9aa4b2" }} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0A1A40", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// Investor rating as a circular gauge (score + tier), chip-styled to sit in the stat grid.
function InvestorRatingChip({ score, tier }: { score: number | null; tier: string }) {
  return (
    <div style={{ background: "#F6F8FB", border: "1px solid transparent", borderRadius: 8, padding: "9px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Investor rating</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <RatingRing score={score} size={40} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0C447C", background: "#E6F1FB", borderRadius: 20, padding: "2px 10px" }}>{tier}</span>
      </div>
    </div>
  );
}
function Row({ icon, label, value, link }: { icon: string; label: string; value: string | null; link?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 8px", padding: "5px 0", fontSize: 12.5 }}>
      <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0 }} />
      <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: link && value ? "#185FA5" : "var(--foreground)", flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.5 }}>{value || "—"}</span>
    </div>
  );
}
// One click-to-edit profile field. In edit mode, fields with a known option list
// (Odoo selection / many2many) show a searchable checkbox dropdown with chips
// (Option 1); free-text fields fall back to a plain input. Inline save (check) + undo.
function EditablePrefRow({
  label, value, changed, editing, rating, options, freeText = false, single = false, derivedFrom, onOpen, onChange, onSave, onUndo,
}: {
  label: string; value: string; changed: boolean; editing: boolean; rating: boolean; options: string[];
  freeText?: boolean; single?: boolean;
  /** Set when we derived this value ourselves rather than being told it. */
  derivedFrom?: string;
  onOpen: () => void; onChange: (v: string) => void; onSave: () => void; onUndo: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [search, setSearch] = useState("");
  const selected = value.split(",").map((s) => s.trim()).filter(Boolean);

  if (editing && options.length > 0) {
    const selSet = new Set(selected);
    const allOpts = [...new Set([...options, ...selected])];
    const filtered = allOpts.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()));
    // Single-select fields (ARR/MRR bands) replace the value; multi-select toggle.
    const toggle = (o: string) => single
      ? onChange(selSet.has(o) ? "" : o)
      : onChange((selSet.has(o) ? selected.filter((x) => x !== o) : [...selected, o]).join(", "));
    const chipBg = rating ? "#E1F5EE" : "#EEEDFE";
    const chipFg = rating ? "#0F6E56" : "#3C3489";
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 8px", background: "#F7F8FA", borderRadius: 8, fontSize: 12.5 }}>
        <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)", paddingTop: 6 }}>{label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0, border: "0.5px solid #4338CA", borderRadius: 6, padding: "5px 8px", boxShadow: "0 0 0 2px #EEEDFE", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", background: "#fff" }}>
              {selected.length === 0 && <span style={{ color: "var(--muted-foreground)" }}>Select…</span>}
              {selected.map((v) => (
                <span key={v} style={{ fontSize: 11, background: chipBg, color: chipFg, borderRadius: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  {v}
                  <i className="ti ti-x" onClick={() => toggle(v)} style={{ fontSize: 11, cursor: "pointer" }} aria-hidden="true" />
                </span>
              ))}
            </div>
            <button onClick={onSave} aria-label="Save field" style={{ width: 30, height: 30, flexShrink: 0, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>
            <button onClick={onUndo} aria-label="Undo field" style={{ width: 30, height: 30, flexShrink: 0, background: "none", border: "0.5px solid #d7dbe3", borderRadius: 6, cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
          </div>
          <div style={{ marginTop: 5, border: "0.5px solid var(--border)", borderRadius: 8, background: "#fff", padding: 5, maxWidth: 320 }}>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ width: "100%", boxSizing: "border-box", height: 28, fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 5, padding: "0 8px", marginBottom: 4 }} />
            <div style={{ maxHeight: 176, overflowY: "auto" }}>
              {filtered.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "4px 6px" }}>No matches.</div>}
              {filtered.map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer" }}>
                  <input type={single ? "radio" : "checkbox"} name={single ? `pick-${label}` : undefined} checked={selSet.has(o)} onChange={() => toggle(o)} style={{ width: 14, height: 14 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    // Long free-text fields (Business summary, Management team) get a multi-line
    // textarea; other plain fields keep a single-line input.
    return (
      <div style={{ display: "flex", gap: 8, alignItems: freeText ? "flex-start" : "center", padding: "5px 8px", background: "#F7F8FA", borderRadius: 8, fontSize: 12.5 }}>
        <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)", paddingTop: freeText ? 6 : 0 }}>{label}</span>
        {freeText ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(); if (e.key === "Escape") onUndo(); }}
            placeholder="Type a value…  (⌘/Ctrl+Enter to save)"
            rows={4}
            style={{ flex: 1, minWidth: 0, fontSize: 12, border: "0.5px solid #4338CA", borderRadius: 6, padding: "6px 8px", boxShadow: "0 0 0 2px #EEEDFE", resize: "vertical", lineHeight: 1.5 }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onUndo(); }}
            placeholder="Type a value…"
            style={{ flex: 1, minWidth: 0, height: 30, fontSize: 12, border: "0.5px solid #4338CA", borderRadius: 6, padding: "0 8px", boxShadow: "0 0 0 2px #EEEDFE" }}
          />
        )}
        <button onClick={onSave} aria-label="Save field" style={{ width: 30, height: 30, flexShrink: 0, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>
        <button onClick={onUndo} aria-label="Undo field" style={{ width: 30, height: 30, flexShrink: 0, background: "none", border: "0.5px solid #d7dbe3", borderRadius: 6, cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
      </div>
    );
  }
  // Free-text fields render as one paragraph; option/multi fields split into chips.
  const values = freeText ? (value.trim() ? [value.trim()] : []) : value.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "flex-start", padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)" }}>{label}</span>
      <span
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Click to edit"
        style={{ flex: "1 1 160px", minWidth: 0, cursor: "pointer", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, borderRadius: 6, padding: "2px 4px", margin: "-2px -4px", background: hover ? "#F1EFE8" : "transparent", overflowWrap: "anywhere", lineHeight: 1.5 }}
      >
        {values.length === 0 ? (
          <span style={{ color: "var(--muted-foreground)" }}>—</span>
        ) : values.length === 1 && URLISH.test(values[0]) ? (
          // stopPropagation so following the link doesn't also open the editor; the
          // pencil and the rest of the row still start an edit.
          <a
            href={hrefOf(values[0])} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#3C3489", textDecoration: "underline", overflowWrap: "anywhere" }}
          >
            {values[0]} <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 11 }} />
          </a>
        ) : values.length === 1 && values[0].length > 40 ? (
          <span style={{ color: "var(--foreground)", overflowWrap: "anywhere" }}>{values[0]}</span>
        ) : values.map((v) => (
          <span key={v} style={{ fontSize: 11, background: rating ? "#E1F5EE" : "#EEEDFE", color: rating ? "#0F6E56" : "#3C3489", borderRadius: 12, padding: "2px 9px", whiteSpace: "nowrap" }}>{v}</span>
        ))}
        <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 12.5, color: "var(--muted-foreground)", opacity: hover ? 1 : 0, marginLeft: 2 }} />
        {changed ? <span style={{ fontSize: 10, color: "#854F0B", background: "#FAEEDA", borderRadius: 10, padding: "1px 7px" }}>edited</span> : null}
        {/* An assumption we made from the investor's type — not something they told us.
            Without this a derived stage is indistinguishable from a stated one. */}
        {derivedFrom && !changed ? (
          <span
            title={`Assumed from investor type (${derivedFrom.replace("derived:", "").replace(/_/g, " ")}). Not stated by the investor — edit to confirm.`}
            style={{ fontSize: 10, color: "#6B3FA0", background: "#F3ECFB", border: "0.5px solid #C9B8E6", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}
          >assumed</span>
        ) : null}
      </span>
    </div>
  );
}

export type LinkedCompany = {
  id: string;
  companyName: string | null;
  industry: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  description: string | null;
  website: string | null;
  country: string | null;
  state: string | null;
  useOfFunds: string | null;
  // Seeking + Company & stage (from onboarding; migration 20260803002)
  fundingStage: string | null;
  operatingStage: string | null;
  businessEntity: string | null;
  annualEbitda: string | null;
  managementTeam: string | null;
  seekingInvestorTypes: string | null;
  seekingCapitalTypes: string | null;
  activeInvestorPreference: string | null;
};

// Read-only display row for linked / recap sections (not click-to-edit).
function RoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children == null || children === "" || children === "—";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "flex-start", padding: "5px 0", fontSize: 12.5, borderBottom: "0.5px solid #f1f5f9" }}>
      <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ flex: "1 1 160px", minWidth: 0, color: empty ? "var(--muted-foreground)" : "var(--foreground)", display: "flex", flexWrap: "wrap", gap: 5, overflowWrap: "anywhere" }}>{empty ? "—" : children}</span>
    </div>
  );
}

type FormdFirmSummary = { regd_footprint: number | null; vehicle_count: number | null; fund_types: string[] | null; last_investment_at: string | null; last_investment_issuer: string | null; last_investment_round_size: number | null; activity_band: string | null; state_or_country: string | null; investments_24mo: number | null };
const fmtUsdM = (n: number | null | undefined) => (n == null ? "—" : `$${(n / 1_000_000).toFixed(1)}M`);

export function ContactProfileClient({ contact: initialContact, opportunities, staff, leadStaff, activity, isSuperAdmin = false, onePager = null, company = null, odooMessages = [], bookings = [], investorRating = null, formdFirm = null, crr = null, memberPlan = null, basePath = "/admin/sales/contacts" }: { contact: Contact; opportunities: LinkedOpp[]; staff: Staff[]; leadStaff?: Staff[]; activity: Activity[]; isSuperAdmin?: boolean; onePager?: { slug: string | null; published: boolean; companyName: string | null } | null; company?: LinkedCompany | null; odooMessages?: OdooMsg[]; bookings?: BookingLite[]; investorRating?: { score: number | null; tier: string } | null; formdFirm?: FormdFirmSummary | null; crr?: { score: number; tier: string } | null; memberPlan?: string | null; basePath?: string }) {
  const assignableStaff = leadStaff ?? staff;
  const router = useRouter();
  const [contact, setContact] = useState<Contact>(initialContact);
  const [note, setNote] = useState("");
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Surfaced when a save/edit/task action fails, so buttons don't silently no-op.
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [showTask, setShowTask] = useState(false);
  const [task, setTask] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [contactTasks, setContactTasks] = useState<{ id: string; title: string; task_type: string; due_date: string | null; status: string; assignee_name: string | null }[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<string | null>(initialContact.note);
  const [editing, setEditing] = useState(false);
  // Tags edit: a token multi-select over the comma-joined form.tags string.
  const [tagInput, setTagInput] = useState("");
  // Self-contained editor for the structured "Additional details" fields.
  const [prefBusy, setPrefBusy] = useState(false);
  // Click-to-edit: values are staged in prefEdits (keyed by save-label);
  // prefOrig is the last-saved baseline for dirty detection + undo.
  const initialProfile = groupContactProfile(initialContact.extra, initialContact.membership);
  const seedPrefs = () => {
    const o: Record<string, string> = {};
    for (const s of initialProfile.sections) for (const f of s.fields) o[f.saveKey] = f.values.join(", ");
    // SEC Form D-only investors: fill EMPTY thesis/rating fields with defaults
    // derived from the filing. Real synced values (non-empty above) are left as-is,
    // and this is display-only — seeded into both edits + baseline, so nothing is
    // written unless staff actually change it.
    if (initialProfile.type === "investor" && formdFirm) {
      const regd = formdFirm.regd_footprint ?? null;
      const bands = regd != null
        ? INVESTMENT_SIZE_BANDS.filter((b) => { const r = parseMoneyBand(b); return r != null && r.min < regd; })
        : [];
      const fill = (key: string, val: string) => { if (!o[key]?.trim() && val) o[key] = val; };
      fill("Active investor", "5-Excellent");
      fill("Investor investment size?", bands.join(", "));
      fill("Investor type", "Venture, Hedge Fund, Family Office, Fund Manager, Other");
      fill("Investor preferences for the number of deals per year?", "5 - 10 Deals");
    }
    return o;
  };
  const [prefEdits, setPrefEdits] = useState<Record<string, string>>(seedPrefs);
  const [prefOrig, setPrefOrig] = useState<Record<string, string>>(seedPrefs);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Sub-tab strip at the profile position: Profile · Note Log · Activity.
  const [profileSub, setProfileSub] = useState<"sendmsg" | "profile" | "notelog" | "tasks">("profile");
  // ── Send message: a real email composer (same engine as mass-email) ──────────
  type MailTemplate = { id: string; name: string; subject: string; html_body: string; department: string | null };
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [mailChannel, setMailChannel] = useState<"icapos" | "gmail">("icapos");
  const [mailTemplateId, setMailTemplateId] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState<string | null>(null);
  // Emails sent from this screen this session — prepended to the history for instant
  // feedback (they also persist to the sales timeline server-side via the send route).
  const [sentMail, setSentMail] = useState<{ id: string; author: string; date: string; subject: string; body: string }[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/marketing/templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => { if (active) setMailTemplates((d.templates ?? d ?? []) as MailTemplate[]); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  // Option lists per profile field (Odoo selection / many2many) for the pickers.
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let active = true;
    fetch("/api/sales/contacts/field-options")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.options) setFieldOptions(d.options as Record<string, string[]>); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  // Read-view "Lead assign" control (super admin only) — saves assignees directly.
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSel, setLeadSel] = useState<string[]>(initialContact.assignee_ids ?? []);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initialContact.name ?? "",
    lead_status: initialContact.lead_status ?? "new",
    email: initialContact.email ?? "", company: initialContact.company ?? "",
    phone: initialContact.phone ?? "", phone2: initialContact.phone2 ?? "",
    website: initialContact.website ?? "", owner: initialContact.owner ?? "", owner_id: initialContact.owner_id ?? "",
    assignee_ids: initialContact.assignee_ids ?? [],
    membership: initialContact.membership ?? "", job_position: initialContact.job_position ?? "",
    lead_source: initialContact.lead_source ?? "", language: initialContact.language ?? "",
    street: initialContact.street ?? "", street2: initialContact.street2 ?? "",
    city: initialContact.city ?? "", state: initialContact.state ?? "", zip: initialContact.zip ?? "", country: initialContact.country ?? "",
    tags: initialContact.tags.join(", "),
  });
  const [section, setSection] = useState<"details" | "activity" | "onepager">("details");
  const [actFilter, setActFilter] = useState<"all" | "call" | "note" | "task" | "stage">("all");
  const [acts, setActs] = useState<Activity[]>(activity);
  const [call, setCall] = useState({ outcome: "connected", duration: "", notes: "" });

  async function logTouch(channel: "email" | "message") {
    try {
      await fetch(`/api/sales/contacts/${contact.id}/touch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      const summary = channel === "email" ? "Email opened" : "Text message opened";
      setActs((p) => [{ id: `tmp-${Date.now()}`, kind: channel, summary, actor_name: "You", created_at: new Date().toISOString() }, ...p]);
    } catch { /* ignore */ }
  }

  async function logCall() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(call) });
      if (res.ok) {
        const label: Record<string, string> = { connected: "connected", voicemail: "voicemail", no_answer: "no answer", wrong_number: "wrong number" };
        const parts = [`Call — ${label[call.outcome]}`];
        if (call.duration) parts.push(call.duration);
        if (call.notes) parts.push(`"${call.notes.trim()}"`);
        setActs((p) => [{ id: `tmp-${Date.now()}`, kind: "call", summary: parts.join(" · "), actor_name: "You", created_at: new Date().toISOString() }, ...p]);
        setCall({ outcome: "connected", duration: "", notes: "" });
      }
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    setBusy(true);
    setActionErr(null);
    try {
      const body = {
        name: form.name.trim() || contact.name,
        lead_status: form.lead_status,
        email: form.email || null, company: form.company || null,
        phone: form.phone || null, phone2: form.phone2 || null,
        website: form.website || null, owner: form.owner || null, owner_id: form.owner_id || null,
        membership: form.membership || null, job_position: form.job_position || null,
        lead_source: form.lead_source || null, language: form.language || null,
        street: form.street || null, street2: form.street2 || null,
        city: form.city || null, state: form.state || null, zip: form.zip || null, country: form.country || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setContact({ ...contact, ...body }); setEditing(false); }
      else setActionErr((await res.json().catch(() => ({})))?.error || "Couldn’t save the contact. Please try again.");
    } catch {
      setActionErr("Network error — couldn’t save the contact.");
    } finally { setBusy(false); }
  }

  async function savePreferences() {
    setPrefBusy(true);
    setActionErr(null);
    try {
      const preferences: Record<string, string[]> = {};
      for (const [label, csv] of Object.entries(prefEdits)) {
        preferences[label] = csv.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) {
        const newExtra = Object.entries(preferences)
          .map(([label, values]) => ({ label, values }))
          .filter((e) => e.values.length);
        setContact({ ...contact, extra: newExtra });
        setPrefOrig({ ...prefEdits });
        setEditingKey(null);
      } else {
        setActionErr((await res.json().catch(() => ({})))?.error || "Couldn’t save your changes. Please try again.");
      }
    } catch {
      setActionErr("Network error — couldn’t save your changes.");
    } finally {
      setPrefBusy(false);
    }
  }

  // The check on a row saves just that field immediately (writes only its override),
  // then re-reads the profile so the grouping stays canonical and reseeds the
  // editor baseline. This is what makes a single click-to-edit actually persist.
  async function saveField(key: string) {
    setPrefBusy(true);
    setActionErr(null);
    try {
      const values = (prefEdits[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [key]: values } }),
      });
      if (!res.ok) {
        setActionErr((await res.json().catch(() => ({})))?.error || "Couldn’t save that field. Please try again.");
        return;
      }
      const fresh = await fetch(`/api/sales/contacts/${contact.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (fresh?.contact) {
        setContact(fresh.contact);
        const grouped = groupContactProfile(fresh.contact.extra, fresh.contact.membership);
        const o: Record<string, string> = {};
        for (const s of grouped.sections) for (const f of s.fields) o[f.saveKey] = f.values.join(", ");
        setPrefEdits(o);
        setPrefOrig(o);
      } else {
        setPrefOrig((p) => ({ ...p, [key]: prefEdits[key] ?? "" }));
      }
      setEditingKey(null);
    } finally {
      setPrefBusy(false);
    }
  }

  async function saveLeadAssign() {
    setLeadSaving(true); setLeadMsg(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_ids: leadSel }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setContact({ ...contact, assignee_ids: leadSel });
      setLeadOpen(false);
    } catch (e) { setLeadMsg(e instanceof Error ? e.message : "Save failed."); } finally { setLeadSaving(false); }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true); setNoteMsg(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setSavedNotes((prev) => (prev ? `${prev}\n[${new Date().toISOString().slice(0, 10)}] ${note}` : `[${new Date().toISOString().slice(0, 10)}] ${note}`));
      setNote(""); setNoteMsg("Saved.");
    } catch (e) { setNoteMsg(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }
  function pickMailTemplate(id: string) {
    setMailTemplateId(id);
    const t = mailTemplates.find((x) => x.id === id);
    if (t) { setMailSubject(t.subject); setMailBody(t.html_body); }
  }
  // One shared POST to the mass-email engine, scoped to this single contact.
  async function postMail(body: Record<string, unknown>) {
    return fetch("/api/marketing/mass-email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "contacts", mode: "ids", ids: [contact.id], channel: mailChannel, templateId: mailTemplateId || null, subject: mailSubject || null, html: mailBody || null, ...body }),
    });
  }
  async function sendMailTest() {
    setMailBusy(true); setMailMsg(null);
    try {
      const r = await postMail({ action: "test", testEmail: "" });
      const j = await r.json().catch(() => ({}));
      setMailMsg(r.ok ? `Test sent to ${j.to ?? "you"}.` : (j.error ?? "Test failed."));
    } catch { setMailMsg("Network error — test not sent."); } finally { setMailBusy(false); }
  }
  async function sendMail() {
    if (!contact.email) { setMailMsg("Add an email to this contact first."); return; }
    if (!mailSubject.trim() && !mailBody.trim()) { setMailMsg("Pick a template or write a subject and body first."); return; }
    setMailBusy(true); setMailMsg(null);
    try {
      const r = await postMail({ action: "send" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMailMsg(j.error ?? "Send failed."); return; }
      if ((j.sent ?? 0) === 0 && (j.skipped || j.skippedNoEmail)) {
        setMailMsg(j.skipped ? "Not sent — the contact is unsubscribed." : "Not sent — no email on file.");
        return;
      }
      const now = new Date().toISOString();
      setSentMail((p) => [{ id: `sent-${Date.now()}`, author: "You", date: now, subject: mailSubject.trim(), body: mailBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }, ...p]);
      setActs((p) => [{ id: `tmp-${Date.now()}`, kind: "email", summary: `Email sent${mailSubject.trim() ? `: ${mailSubject.trim()}` : ""}`, actor_name: "You", created_at: now }, ...p]);
      setMailSubject(""); setMailBody(""); setMailTemplateId(""); setMailMsg(`Sent via ${mailChannel === "gmail" ? "Gmail" : "iCapOS"}.`);
    } catch { setMailMsg("Network error — email not sent."); } finally { setMailBusy(false); }
  }
  async function createTask() {
    if (!task.title.trim()) return;
    setBusy(true); setActionErr(null);
    try {
      const res = await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: task.title, taskType: task.taskType, dueDate: task.dueDate || null, assigneeId: task.assigneeId || null, contactCrmId: contact.id, contactName: contact.name }) });
      if (!res.ok) { setActionErr((await res.json().catch(() => ({})))?.error || "Couldn’t create the task."); return; }
      setShowTask(false); setTask({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
      await loadContactTasks();
    } catch { setActionErr("Network error — couldn’t create the task."); } finally { setBusy(false); }
  }
  async function loadContactTasks() {
    try {
      const res = await fetch(`/api/sales/tasks?scope=all&contactCrmId=${encodeURIComponent(contact.id)}`);
      const data = res.ok ? await res.json() : { tasks: [] };
      setContactTasks(data.tasks ?? []);
    } catch { setContactTasks([]); }
    setTasksLoaded(true);
  }
  async function taskDone(id: string) {
    setBusy(true); setActionErr(null);
    try {
      const res = await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
      if (!res.ok) { setActionErr("Couldn’t mark the task done."); return; }
      await loadContactTasks();
    } catch { setActionErr("Network error — couldn’t update the task."); } finally { setBusy(false); }
  }
  async function taskDelete(id: string) {
    setBusy(true); setActionErr(null);
    try {
      const res = await fetch(`/api/sales/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) { setActionErr("Couldn’t delete the task."); return; }
      setConfirmTaskId(null); await loadContactTasks();
    } catch { setActionErr("Network error — couldn’t delete the task."); } finally { setBusy(false); }
  }
  function openTasksTab() {
    setProfileSub("tasks");
    if (!tasksLoaded) void loadContactTasks();
  }

  const address = [contact.street, contact.street2, contact.city, contact.state, contact.zip, contact.country].filter(Boolean).join(", ") || null;
  const pipelineCents = opportunities.reduce((a, o) => a + (o.value_cents ?? 0), 0);
  const openOpps = opportunities.filter((o) => o.status === "open").length;
  // Stat cards deep-link to their data: one deal opens directly; several scroll
  // to the linked-opportunities list. Last activity opens the activity feed.
  const goToOpps = () => {
    if (opportunities.length === 1) { router.push(`/admin/sales/opportunities/${opportunities[0].id}`); return; }
    if (opportunities.length === 0) return;
    setSection("details");
    setTimeout(() => document.getElementById("linked-opps")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const goToActivity = () => {
    setSection("activity");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };
  const lastActLabel = acts[0] ? actWhen(acts[0].created_at) : "—";
  const subtitle = [contact.job_position, contact.company, [contact.city, contact.country].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ") || "—";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href={basePath} style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Contacts</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{contact.name}</span>
      </div>

      {actionErr ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12.5, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F3C6C6", borderRadius: 8, padding: "8px 12px" }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span style={{ flex: 1 }}>{actionErr}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionErr(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D" }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      ) : null}

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Redesigned header: identity + status + owner, actions, stat chips */}
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, flex: "0 0 auto" }}>{contact.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{contact.name}</span>
                {contact.lead_status ? <StatusPill status={contact.lead_status} /> : null}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{subtitle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {contact.phone
                ? <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-phone" aria-hidden="true" /> Call</a>
                : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-phone" aria-hidden="true" /> Call</span>}
              {contact.email
                ? <a href={`/admin/inbox?compose=1&to=${encodeURIComponent(contact.email)}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("email")} style={{ fontSize: 11.5, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email</a>
                : <span title="No email on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-mail" aria-hidden="true" /> Email</span>}
              {contact.phone
                ? <a href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("message")} style={{ fontSize: 11.5, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Message</a>
                : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-message" aria-hidden="true" /> Message</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 14 }}>
            <Chip label="Opportunities" value={opportunities.length} onClick={goToOpps} />
            <Chip label="Pipeline value" value={money(pipelineCents)} onClick={goToOpps} />
            <Chip label="Open opps" value={openOpps} onClick={goToOpps} />
            <Chip label="Last activity" value={lastActLabel} onClick={goToActivity} />
            {investorRating ? <InvestorRatingChip score={investorRating.score} tier={investorRating.score != null ? investorRating.tier : "New"} /> : null}
            {crr ? <Chip label="CRR" value={`${crr.score} · ${crr.tier}`} /> : null}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <button onClick={() => setSection("details")} style={{ fontSize: 12.5, fontWeight: section === "details" ? 600 : 400, color: section === "details" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "details" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Details</button>
          {onePager ? (
            <button onClick={() => setSection("onepager")} style={{ fontSize: 12.5, fontWeight: section === "onepager" ? 600 : 400, color: section === "onepager" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "onepager" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>One pager</button>
          ) : null}
        </div>

        {section === "details" && (<>
        {/* Field grid */}
        {editing ? (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: RESP_COLS, gap: "10px 24px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" style={{ ...inp, width: "100%", marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lead status</label>
                <select value={form.lead_status} onChange={(e) => setForm({ ...form, lead_status: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>
                  {(LEAD_STATUSES.includes(form.lead_status) || !form.lead_status ? LEAD_STATUSES : [form.lead_status, ...LEAD_STATUSES]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {isSuperAdmin && staff.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lead owner <span style={{ color: "var(--muted-foreground)" }}>(super admin)</span></label>
                  <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {([
                ["email", "Email", "name@company.com"], ["company", "Company", ""],
                ["phone", "Phone", "+1 …"], ["phone2", "Phone 2", ""],
                ["website", "Website", "example.com"], ["owner", "Owner", ""],
                ["membership", "Membership", ""], ["job_position", "Job position", ""],
                ["lead_source", "Lead source", ""],
              ] as const).map(([key, label, ph]) => {
                const opts =
                  key === "owner" ? staff.map((s) => s.name)
                  : key === "membership" ? MEMBERSHIP_OPTS
                  : key === "job_position" ? JOB_POSITION_OPTS
                  : key === "lead_source" ? LEAD_SOURCE_OPTS
                  : null;
                const cur = form[key];
                const listed = opts && (cur && !opts.includes(cur) ? [cur, ...opts] : opts);
                return (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</label>
                    {listed ? (
                      <select value={cur} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>
                        <option value="">—</option>
                        {listed.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={cur} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} style={{ ...inp, width: "100%", marginTop: 4 }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>Address</div>
              <div style={{ display: "grid", gridTemplateColumns: RESP_COLS_SM, gap: "10px 16px" }}>
                {([
                  ["street", "Street", "1 / -1"], ["street2", "Street 2", "1 / -1"],
                  ["city", "City", "auto"], ["state", "State", "auto"], ["zip", "ZIP", "auto"], ["country", "Country", "auto"],
                ] as const).map(([key, label, span]) => (
                  <div key={key} style={span === "1 / -1" ? { gridColumn: "1 / -1" } : undefined}>
                    <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</label>
                    <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Tags</label>
              {(() => {
                const current = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
                const addTag = (raw: string) => {
                  const name = raw.trim();
                  if (!name || current.some((t) => t.toLowerCase() === name.toLowerCase())) { setTagInput(""); return; }
                  setForm({ ...form, tags: [...current, name].join(", ") });
                  setTagInput("");
                };
                const removeTag = (tg: string) => setForm({ ...form, tags: current.filter((t) => t !== tg).join(", ") });
                return (
                  <div style={{ ...inp, width: "100%", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", minHeight: 34 }}>
                    {current.map((tg) => { const c = tagColor(tg); return (
                      <span key={tg} style={{ fontSize: 11, background: c.bg, color: c.fg, borderRadius: 12, padding: "1px 4px 1px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {tg}<i className="ti ti-x" aria-hidden="true" style={{ fontSize: 10, cursor: "pointer" }} onClick={() => removeTag(tg)} />
                      </span>
                    ); })}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } else if (e.key === "Backspace" && !tagInput && current.length) { removeTag(current[current.length - 1]); } }}
                      onBlur={() => addTag(tagInput)}
                      placeholder={current.length ? "Add a tag…" : "Type a tag, press Enter…"}
                      style={{ border: "none", outline: "none", flex: 1, minWidth: 90, fontSize: 12, background: "transparent", color: "var(--foreground)" }}
                    />
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
              <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ ...outlineBtn, padding: "8px 16px" }}>Cancel</button>
              <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", alignSelf: "center" }}>Edits save to your CRM mirror and persist across Odoo re-syncs.</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: "6px 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
            {/* Edit hint for the Details section — opens the edit form (replaces the Edit button). */}
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
              <button onClick={() => setEditing(true)} style={{ fontSize: 11, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}><i className="ti ti-click" aria-hidden="true" /> Click any field to edit</button>
            </div>
            {/* LEFT column — Odoo field order */}
            <div>
              <Row icon="ti-id-badge" label="Membership Type" value={contact.membership} />
              {/* Member Portal Plan — live subscription plan (read-only). */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                <i className="ti ti-crown" aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0 }} />
                <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0 }}>Member Portal Plan</span>
                {memberPlan ? <span style={{ fontSize: 11, fontWeight: 600, color: "#3C3489", background: "#EEEDFE", borderRadius: 20, padding: "1px 9px" }}>{memberPlan}</span> : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
              </div>
              <Row icon="ti-flag" label="Lead Status" value={contact.lead_status} />
              <Row icon="ti-arrow-down-circle" label="Lead Source" value={contact.lead_source} />
              <Row icon="ti-map-pin" label="Contact" value={address} />
              <Row icon="ti-hash" label="EIN" value={null} />
              <Row icon="ti-certificate" label="Operator Licence" value={null} />
              <Row icon="ti-id" label="CURP" value={null} />
            </div>
            {/* RIGHT column — Odoo field order */}
            <div>
              <Row icon="ti-briefcase" label="Job Position" value={contact.job_position} />
              <Row icon="ti-phone" label="Phone" value={contact.phone} />
              <Row icon="ti-phone" label="Phone 2" value={contact.phone2} />
              <Row icon="ti-device-mobile" label="Mobile" value={null} />
              <Row icon="ti-mail" label="Email" value={contact.email} link />
              <Row icon="ti-world" label="Website" value={contact.website} link />
              <Row icon="ti-calendar" label="Created on" value={contact.created_on ? contact.created_on.slice(0, 10) : null} />
              {/* Tags — colored pills, auto color per tag name. */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                <i className="ti ti-tag" aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0, marginTop: 2 }} />
                <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }}>Tags</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {contact.tags.length === 0 ? <span style={{ color: "var(--muted-foreground)" }}>—</span> : contact.tags.map((tg) => { const c = tagColor(tg); return <span key={tg} style={{ fontSize: 11, background: c.bg, color: c.fg, borderRadius: 12, padding: "1px 9px" }}>{tg}</span>; })}
                </span>
              </div>
              {/* Lead assign — under Lead source. Editable by super admin only. */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                <i className="ti ti-users" aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0, marginTop: 3 }} />
                <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0, marginTop: 3 }}>Lead assign</span>
                <div style={{ minWidth: 0, flex: 1, position: "relative" }}>
                  {isSuperAdmin ? (() => {
                    const chosen = staff.filter((s) => leadSel.includes(s.id));
                    const matches = assignableStaff.filter((s) => s.name.toLowerCase().includes(leadSearch.toLowerCase()));
                    return (
                      <>
                        <div onClick={() => setLeadOpen((v) => !v)} style={{ ...inp, width: "100%", minHeight: 30, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", cursor: "pointer", borderColor: leadOpen ? "#2E78F5" : undefined }}>
                          {chosen.length === 0 && <span style={{ color: "var(--muted-foreground)" }}>Assign members…</span>}
                          {chosen.map((s) => (
                            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#E6F1FB", color: "#185FA5", borderRadius: 20, padding: "1px 6px 1px 8px" }}>
                              {s.name}
                              <i className="ti ti-x" style={{ fontSize: 10, cursor: "pointer" }} aria-hidden="true" onClick={(e) => { e.stopPropagation(); setLeadSel((p) => p.filter((x) => x !== s.id)); }} />
                            </span>
                          ))}
                          <i className="ti ti-chevron-down" style={{ marginLeft: "auto", color: "var(--muted-foreground)" }} aria-hidden="true" />
                        </div>
                        {leadOpen && (
                          <>
                            <div onClick={() => setLeadOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 30, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 9, boxShadow: "0 10px 26px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                              <div style={{ padding: "7px 9px", borderBottom: "0.5px solid #eef1f5" }}>
                                <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} autoFocus placeholder="Search members…" style={{ ...inp, width: "100%" }} />
                              </div>
                              <div style={{ maxHeight: 168, overflowY: "auto" }}>
                                {matches.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "8px 11px" }}>No members.</div>}
                                {matches.map((s) => {
                                  const on = leadSel.includes(s.id);
                                  const isOwner = contact.owner_id === s.id;
                                  return (
                                    <label key={s.id} title={isOwner ? "Already the owner" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", fontSize: 12.5, cursor: isOwner ? "not-allowed" : "pointer", opacity: isOwner ? 0.45 : 1 }}>
                                      <input type="checkbox" checked={on} disabled={isOwner} onChange={() => setLeadSel((p) => on ? p.filter((x) => x !== s.id) : [...p, s.id])} style={{ width: 14, height: 14 }} />
                                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderTop: "0.5px solid #eef1f5" }}>
                                <button onClick={saveLeadAssign} disabled={leadSaving} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", opacity: leadSaving ? 0.6 : 1 }}>{leadSaving ? "Saving…" : "Save"}</button>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{leadSel.length} selected</span>
                                {leadMsg && <span style={{ fontSize: 11, color: "#A32D2D" }}>{leadMsg}</span>}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })() : (
                    <span style={{ color: contact.assignee_ids.length ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {contact.assignee_ids.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "—"}
                    </span>
                  )}
                </div>
              </div>
              {/* Owner + Source — iCapOS internal, kept below the Odoo fields. */}
              <Row icon="ti-user-check" label="Owner" value={contact.owner} />
              <Row icon="ti-plug" label="Source" value={contact.source} />
            </div>
            {(() => {
              const profile = groupContactProfile(contact.extra, contact.membership, contact.derivedSources);
              if (profile.sections.length === 0) return null;
              const hasInfoSection = profile.sections.some((s) => s.title.toLowerCase().includes("information"));
              // "Other details" (leftover unmapped fields) is folded into the merged
              // overview section, so it never renders as its own block.
              const overviewTitle = profile.type === "investor" ? "Investor overview" : profile.type === "founder" ? "Founder overview" : "Overview";
              const otherDetailsFields = profile.sections.find((s) => s.title === "Other details")?.fields ?? [];
              // "Investor type" (raw.__profile.investorTypes) — surfaced as an editable
              // multi-select in Contact & lead; same data the Group-by "Investor type" uses.
              const investorProfileKey = profile.sections.flatMap((s) => s.fields).find((f) => /investor type/i.test(f.label))?.saveKey ?? "Investor type";
              const formdBlock = formdFirm ? (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#4338CA", margin: "0 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5" }}>SEC Form D</p>
                  <div style={{ display: "grid", gridTemplateColumns: RESP_COLS, gap: "2px 28px" }}>
                    <RoRow label="Capital raised (Reg D)">{fmtUsdM(formdFirm.regd_footprint)}</RoRow>
                    <RoRow label="Vehicles / funds">{formdFirm.vehicle_count != null ? String(formdFirm.vehicle_count) : null}</RoRow>
                    <RoRow label="Fund types">{formdFirm.fund_types && formdFirm.fund_types.length ? formdFirm.fund_types.join(", ") : null}</RoRow>
                    <RoRow label="Activity band">{formdFirm.activity_band || null}</RoRow>
                    <RoRow label="Filings (24mo)">{formdFirm.investments_24mo != null ? String(formdFirm.investments_24mo) : null}</RoRow>
                    <RoRow label="Most recent raise">{formdFirm.last_investment_issuer || null}</RoRow>
                  </div>
                  <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "5px 0 0" }}>Capital raised across the fund&rsquo;s Reg D filings &mdash; SEC-verified public record, not assets under management.</p>
                </div>
              ) : null;
              return (
              <div style={{ gridColumn: "1 / -1" }}>
                <div>
                  {/* Founder/Investor Profile · Note Log · Activity strip */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2, borderBottom: "0.5px solid #eef1f5", marginBottom: 10, flexWrap: "wrap" }}>
                    {([["sendmsg", "Send message"], ["notelog", "Note Log"], ["profile", profile.title]] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setProfileSub(k)} style={{ background: "none", border: "none", borderBottom: profileSub === k ? "2px solid #4338CA" : "2px solid transparent", color: profileSub === k ? "#4338CA" : "var(--muted-foreground)", fontSize: 12.5, fontWeight: profileSub === k ? 600 : 400, padding: "8px 12px", cursor: "pointer", marginBottom: "-0.5px" }}>{label}</button>
                    ))}
                    <button onClick={openTasksTab} style={{ background: "none", border: "none", borderBottom: profileSub === "tasks" ? "2px solid #4338CA" : "2px solid transparent", color: profileSub === "tasks" ? "#4338CA" : "var(--muted-foreground)", fontSize: 12.5, fontWeight: profileSub === "tasks" ? 600 : 400, padding: "8px 12px", cursor: "pointer", marginBottom: "-0.5px" }}>Tasks{tasksLoaded && contactTasks.length ? ` · ${contactTasks.length}` : ""}</button>
                    <button onClick={() => setSection("activity")} style={{ background: "none", border: "none", borderBottom: "2px solid transparent", color: "var(--muted-foreground)", fontSize: 12.5, fontWeight: 400, padding: "8px 12px", cursor: "pointer", marginBottom: "-0.5px" }}>Activity{acts.length ? ` · ${acts.length}` : ""}</button>
                  </div>
                  {profileSub === "profile" && (<>
                  {!hasInfoSection && formdBlock}
                  {company && <CompanyLinkedRecordEditor company={company} onePager={onePager} />}
                  {profile.sections.map((sec) => {
                    // The linked-company section above now carries Seeking +
                    // Company & stage from onboarding, so hide the legacy
                    // CRM-import duplicates when a company is linked.
                    if (company && (sec.title === "Seeking" || sec.title === "Company & stage")) return null;
                    const rating = sec.title.toLowerCase().includes("rating");
                    const isInfo = sec.title.toLowerCase().includes("information");
                    // Investor profile is rendered in the overview — drop it here to avoid a duplicate.
                    const visibleFields = sec.fields.filter((f) => f.saveKey !== investorProfileKey);
                    // Other details is folded into the merged overview section below.
                    if (sec.title === "Other details") return null;
                    return (
                      <div key={sec.title}>
                        <div style={{ marginTop: 14 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#4338CA", margin: "0 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5" }}>{isInfo ? overviewTitle : sec.title}</p>
                        {sec.title === "Highlights" ? (
                          (() => {
                            const text = sec.fields.flatMap((f) => f.values).join(" ").trim();
                            return text ? (
                              <details style={{ fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.6 }}>
                                <summary style={{ cursor: "pointer", color: "#4338CA", fontSize: 11.5 }}>Show full highlights</summary>
                                <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{text}</p>
                              </details>
                            ) : (
                              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>—</p>
                            );
                          })()
                        ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2px 28px" }}>
                          {sec.title.toLowerCase().includes("information") && (
                            <>
                              {/* Contact / lead / address rows live in the top block above — not repeated here. */}
                              <RoRow label="Full name">{contact.name || null}</RoRow>
                              <RoRow label="Company">{contact.company || null}</RoRow>
                              <RoRow label="Created on">{contact.created_on ? contact.created_on.slice(0, 10) : null}</RoRow>
                              {profile.type === "investor" && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <EditablePrefRow
                                    label="Investor type"
                                    rating={false}
                                    options={fieldOptions[investorProfileKey] ?? []}
                                    value={prefEdits[investorProfileKey] ?? ""}
                                    changed={(prefEdits[investorProfileKey] ?? "") !== (prefOrig[investorProfileKey] ?? "")}
                                    editing={editingKey === investorProfileKey}
                                    onOpen={() => setEditingKey(investorProfileKey)}
                                    onChange={(v) => setPrefEdits((p) => ({ ...p, [investorProfileKey]: v }))}
                                    onSave={() => saveField(investorProfileKey)}
                                    onUndo={() => { setPrefEdits((p) => ({ ...p, [investorProfileKey]: prefOrig[investorProfileKey] ?? "" })); setEditingKey(null); }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                          {visibleFields.map((f) => (
                            <EditablePrefRow
                              key={f.saveKey}
                              label={f.label}
                              rating={rating}
                              freeText={FREE_TEXT_FIELD_LABELS.has(f.label)}
                              single={SINGLE_SELECT_FIELD_LABELS.has(f.label)}
                              derivedFrom={f.derivedFrom}
                              options={FREE_TEXT_FIELD_LABELS.has(f.label) ? [] : (fieldOptions[f.saveKey] ?? [])}
                              value={prefEdits[f.saveKey] ?? ""}
                              changed={(prefEdits[f.saveKey] ?? "") !== (prefOrig[f.saveKey] ?? "")}
                              editing={editingKey === f.saveKey}
                              onOpen={() => setEditingKey(f.saveKey)}
                              onChange={(v) => setPrefEdits((p) => ({ ...p, [f.saveKey]: v }))}
                              onSave={() => saveField(f.saveKey)}
                              onUndo={() => { setPrefEdits((p) => ({ ...p, [f.saveKey]: prefOrig[f.saveKey] ?? "" })); setEditingKey(null); }}
                            />
                          ))}
                          {isInfo && otherDetailsFields.filter((f) => f.saveKey !== investorProfileKey).map((f) => (
                            <EditablePrefRow
                              key={`od-${f.saveKey}`}
                              label={f.label}
                              rating={false}
                              freeText={FREE_TEXT_FIELD_LABELS.has(f.label)}
                              single={SINGLE_SELECT_FIELD_LABELS.has(f.label)}
                              derivedFrom={f.derivedFrom}
                              options={FREE_TEXT_FIELD_LABELS.has(f.label) ? [] : (fieldOptions[f.saveKey] ?? [])}
                              value={prefEdits[f.saveKey] ?? ""}
                              changed={(prefEdits[f.saveKey] ?? "") !== (prefOrig[f.saveKey] ?? "")}
                              editing={editingKey === f.saveKey}
                              onOpen={() => setEditingKey(f.saveKey)}
                              onChange={(v) => setPrefEdits((p) => ({ ...p, [f.saveKey]: v }))}
                              onSave={() => saveField(f.saveKey)}
                              onUndo={() => { setPrefEdits((p) => ({ ...p, [f.saveKey]: prefOrig[f.saveKey] ?? "" })); setEditingKey(null); }}
                            />
                          ))}
                        </div>
                        )}
                        </div>
                        {isInfo ? formdBlock : null}
                      </div>
                    );
                  })}
                  {(() => {
                    const changedKeys = Object.keys(prefEdits).filter((k) => (prefEdits[k] ?? "") !== (prefOrig[k] ?? ""));
                    if (changedKeys.length === 0) return null;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{changedKeys.length} unsaved change{changedKeys.length === 1 ? "" : "s"}</span>
                        <span style={{ marginLeft: "auto" }} />
                        <button onClick={() => { setPrefEdits({ ...prefOrig }); setEditingKey(null); }} disabled={prefBusy} style={{ fontSize: 12, padding: "6px 12px", border: "0.5px solid #d7dbe3", borderRadius: 6, background: "none", color: "var(--muted-foreground)", cursor: "pointer" }}>Undo all</button>
                        <button onClick={savePreferences} disabled={prefBusy} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", border: "none", borderRadius: 6, background: "#0F6E56", color: "#fff", cursor: "pointer", opacity: prefBusy ? 0.5 : 1 }}>{prefBusy ? "Saving…" : "Save changes"}</button>
                      </div>
                    );
                  })()}
                  </>)}
                  {profileSub === "tasks" && (
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 8 }}><i className="ti ti-link" aria-hidden="true" /> New tasks auto-link to {contact.name}.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 96px 128px 130px", gap: 8, background: "#F5F9FF", border: "0.5px solid #eef1f5", borderRadius: 8, padding: 10 }}>
                        <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Task title" style={inp} />
                        <select value={task.taskType} onChange={(e) => setTask({ ...task, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
                        <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} style={inp} />
                        <select value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{assignableStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <button onClick={createTask} disabled={busy || !task.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !task.title.trim() ? 0.5 : 1 }}>Add task</button>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, border: "0.5px solid #eef1f5", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 92px 96px 68px 66px", gap: 8, padding: "8px 12px", background: "#F7F9FC", fontSize: 10, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted-foreground)", borderBottom: "0.5px solid #eef1f5" }}>
                          <span>Task</span><span>Type</span><span>Due</span><span>Assignee</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
                        </div>
                        {!tasksLoaded ? (
                          <p style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</p>
                        ) : contactTasks.length === 0 ? (
                          <p style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>No tasks for this contact yet.</p>
                        ) : contactTasks.map((ct) => {
                          const cdone = ct.status === "done";
                          if (confirmTaskId === ct.id) {
                            return (
                              <div key={ct.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderTop: "0.5px solid #eef1f5", background: "#FCEBEB" }}>
                                <span style={{ fontSize: 12, color: "#A32D2D" }}>Delete &ldquo;{ct.title}&rdquo;? This can&rsquo;t be undone.</span>
                                <span style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => taskDelete(ct.id)} disabled={busy} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Delete</button>
                                  <button onClick={() => setConfirmTaskId(null)} style={{ fontSize: 11.5, color: "var(--foreground)", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Cancel</button>
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div key={ct.id} style={{ display: "grid", gridTemplateColumns: "1fr 74px 92px 96px 68px 66px", gap: 8, alignItems: "center", padding: "9px 12px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                              <span style={{ textDecoration: cdone ? "line-through" : "none", color: cdone ? "var(--muted-foreground)" : "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ct.title}</span>
                              <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 8, padding: "2px 8px", justifySelf: "start" }}>{ct.task_type}</span>
                              <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{ct.due_date ? ct.due_date.slice(5) : "—"}</span>
                              <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ct.assignee_name ?? "—"}</span>
                              <span style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", justifySelf: "start", color: cdone ? "#0F6E56" : "#854F0B", background: cdone ? "#E1F5EE" : "#FAEEDA" }}>{cdone ? "Done" : "Open"}</span>
                              <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                {!cdone && <button onClick={() => taskDone(ct.id)} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>}
                                <button onClick={() => setConfirmTaskId(ct.id)} disabled={busy} style={{ fontSize: 10.5, color: "#A32D2D", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {profileSub === "sendmsg" && (
                    <div style={{ paddingTop: 4 }}>
                      {/* To + channel */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          To {contact.email
                            ? <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{contact.email}</span>
                            : <span style={{ color: "#A32D2D" }}>no email on file</span>}
                        </div>
                        <div style={{ display: "inline-flex", gap: 2, background: "var(--muted)", border: "0.5px solid var(--border)", borderRadius: 7, padding: 2 }}>
                          {(["icapos", "gmail"] as const).map((c) => (
                            <button key={c} onClick={() => setMailChannel(c)} style={{ fontSize: 10.5, fontWeight: mailChannel === c ? 600 : 400, color: mailChannel === c ? "#fff" : "var(--muted-foreground)", background: mailChannel === c ? "#4338CA" : "transparent", border: "none", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>{c === "icapos" ? "iCapOS" : "Gmail"}</button>
                          ))}
                        </div>
                      </div>
                      {/* Template */}
                      <select value={mailTemplateId} onChange={(e) => pickMailTemplate(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 8 }}>
                        <option value="">Use template…</option>
                        {mailTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} placeholder="Subject… ({{first_name}}, {{company}})" style={{ ...inp, width: "100%", marginBottom: 8 }} />
                      <textarea value={mailBody} onChange={(e) => setMailBody(e.target.value)} placeholder="Write your email… (HTML ok · merge {{first_name}} {{company}})" style={{ ...inp, width: "100%", minHeight: 96, resize: "vertical", fontFamily: "var(--font-mono)" }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button onClick={sendMail} disabled={mailBusy || !contact.email} title={contact.email ? "" : "Add an email to this contact to send"} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#4338CA", border: "none", borderRadius: 6, padding: "6px 14px", cursor: mailBusy || !contact.email ? "not-allowed" : "pointer", opacity: mailBusy || !contact.email ? 0.5 : 1 }}><i className="ti ti-send" aria-hidden="true" /> Send email</button>
                        <button onClick={sendMailTest} disabled={mailBusy} style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cdd9ec)", borderRadius: 6, padding: "6px 12px", cursor: mailBusy ? "not-allowed" : "pointer", opacity: mailBusy ? 0.5 : 1 }}>Send test to me</button>
                        {contact.phone && <a href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("message")} style={{ fontSize: 11, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 6, padding: "6px 12px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Text</a>}
                        {mailMsg && <span style={{ fontSize: 11, color: /sent|Sent/.test(mailMsg) ? "#0F6E56" : "#A32D2D" }}>{mailMsg}</span>}
                      </div>
                      {/* Unified history: emails sent from iCapOS + messages imported from Odoo */}
                      <div style={{ marginTop: 16 }}>
                        {(() => {
                          type H = { key: string; source: "icapos" | "odoo" | "odoo-note"; author: string; date: string; subject: string; body: string };
                          const hist: H[] = [
                            ...sentMail.map((s) => ({ key: s.id, source: "icapos" as const, author: s.author, date: s.date, subject: s.subject, body: s.body })),
                            ...acts.filter((a) => a.kind === "email" && a.summary.startsWith("Email sent") && !a.id.startsWith("tmp-")).map((a) => ({ key: a.id, source: "icapos" as const, author: a.actor_name ?? "iCapOS", date: a.created_at, subject: a.summary.replace(/^Email sent:?\s*/, ""), body: "" })),
                            // The full Odoo thread — messages AND logged notes (both are real
                            // communication history with this contact). Notes are tagged so the
                            // distinction is clear; the Note Log tab still shows notes on their own.
                            ...odooMessages.filter((m) => m.body || m.subject).map((m) => ({ key: `odoo-${m.id}`, source: (m.isNote ? "odoo-note" : "odoo") as "odoo" | "odoo-note", author: m.author ?? "—", date: m.date ?? "", subject: m.isNote ? "" : (m.subject ?? ""), body: m.body })),
                          ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                          const odooCount = hist.filter((h) => h.source === "odoo" || h.source === "odoo-note").length;
                          return (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>Message history{hist.length ? ` · ${hist.length}` : ""}{odooCount ? ` · ${odooCount} from Odoo` : ""}</div>
                              {hist.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflow: "auto" }}>
                                  {hist.map((m) => (
                                    <div key={m.key} style={{ borderBottom: "0.5px solid #eef1f5", paddingBottom: 8 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted-foreground)", flexWrap: "wrap" }}>
                                        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{m.author}</span>
                                        {m.date ? <span>· {new Date(m.date).toLocaleString()}</span> : null}
                                        {m.source === "odoo"
                                          ? <span style={{ fontSize: 9.5, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", borderRadius: 20, padding: "1px 8px" }}><i className="ti ti-cloud-download" aria-hidden="true" /> from Odoo</span>
                                          : m.source === "odoo-note"
                                          ? <span style={{ fontSize: 9.5, fontWeight: 600, color: "#854D0E", background: "#FAEEDA", borderRadius: 20, padding: "1px 8px" }}><i className="ti ti-note" aria-hidden="true" /> Odoo note</span>
                                          : <span style={{ fontSize: 9.5, fontWeight: 600, color: "#3B6D11", background: "#EAF3DE", borderRadius: 20, padding: "1px 8px" }}><i className="ti ti-send" aria-hidden="true" /> sent · iCapOS</span>}
                                      </div>
                                      {m.subject ? <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{m.subject}</div> : null}
                                      {m.body ? <div style={{ fontSize: 11.5, color: "var(--foreground)", whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 2 }}>{m.body}</div> : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>No messages yet. Emails you send here and messages synced from Odoo will appear in this thread.</div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {profileSub === "notelog" && (() => { const odooNotes = odooMessages.filter((m) => m.isNote && m.body); return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, paddingTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log a note</div>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <button onClick={saveNote} disabled={busy || !note.trim()} style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy || !note.trim() ? 0.5 : 1 }}>Save note</button>
                          {noteMsg && <span style={{ fontSize: 11, color: noteMsg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{noteMsg}</span>}
                        </div>
                        {savedNotes ? <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: 10, marginTop: 8 }}>{savedNotes}</div> : null}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log notes{odooNotes.length ? ` · ${odooNotes.length} from Odoo` : ""}</div>
                        {odooNotes.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflow: "auto" }}>
                            {odooNotes.map((m) => (
                              <div key={m.id} style={{ borderBottom: "0.5px solid #eef1f5", paddingBottom: 8 }}>
                                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                  <span style={{ fontWeight: 600, color: "#854D0E" }}>📝 {m.author ?? "—"}</span>{m.date ? ` · ${new Date(m.date).toLocaleString()}` : ""} <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>· from Odoo</span>
                                </div>
                                <div style={{ fontSize: 11.5, color: "var(--foreground)", whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 2 }}>{m.body}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>No log notes yet.</div>
                        )}
                      </div>
                    </div>
                  ); })()}
                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 16px", borderTop: "0.5px solid #eef1f5", borderBottom: "0.5px solid #eef1f5" }}>
          <Link href={`/admin/sales/contacts/${contact.id}/convert`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", textDecoration: "none" }}><i className="ti ti-arrow-right" aria-hidden="true" /> Convert to opportunity</Link>
          <button onClick={() => setShowTask((v) => !v)} style={outlineBtn}><i className="ti ti-calendar-plus" aria-hidden="true" /> Create task</button>
        </div>

        {showTask && (
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 8, alignItems: "center" }}>
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Task title" autoFocus style={inp} />
            <select value={task.taskType} onChange={(e) => setTask({ ...task, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
            <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} style={inp} />
            <select value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={createTask} disabled={busy || !task.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !task.title.trim() ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setShowTask(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {/* Log note + timeline — profile contacts use the Note Log strip above */}
        {groupContactProfile(contact.extra, contact.membership, contact.derivedSources).sections.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "14px 16px" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log a note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button onClick={saveNote} disabled={busy || !note.trim()} style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy || !note.trim() ? 0.5 : 1 }}>Save note</button>
              {noteMsg && <span style={{ fontSize: 11, color: noteMsg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{noteMsg}</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>{savedNotes || "No notes yet."}</div>
          </div>
        </div>
        )}

        </>)}

        {section === "onepager" && onePager && (
          <div style={{ padding: "14px 16px" }}>
            {onePager.slug && onePager.published ? (
              <div style={{ border: "0.5px solid #eef1f5", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-1, #f7f8fa)", borderBottom: "0.5px solid #eef1f5", padding: "7px 12px" }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>One pager — what investors see</span>
                  <a href={`/f/${onePager.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 600, color: "#2E78F5", textDecoration: "none" }}>Open ↗</a>
                </div>
                <iframe src={`/f/${onePager.slug}`} title="One pager" style={{ width: "100%", height: 620, border: "none" }} />
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", padding: "24px 0", textAlign: "center" }}>
                {onePager.companyName ? `${onePager.companyName} hasn't published a one-pager yet.` : "This contact has no published one-pager."}
              </p>
            )}
          </div>
        )}

        {section === "activity" && (
        <div style={{ padding: "14px 16px" }}>
          {bookings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>Bookings · {bookings.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bookings.map((bk) => {
                  const s = new Date(bk.start_time), e = new Date(bk.end_time);
                  const when = `${s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–${e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
                  return (
                    <div key={bk.id} style={{ border: "0.5px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{bk.event_type ?? "Meeting"}</span>
                        <span style={{ fontSize: 9.5, background: bk.status === "cancelled" ? "#FCEBEB" : "#E8F5F1", color: bk.status === "cancelled" ? "#A32D2D" : "#0F6E56", borderRadius: 20, padding: "1px 7px" }}>{bk.status}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>{when}{bk.timezone ? ` ${bk.timezone}` : ""}</span>
                      </div>
                      {(bk.booker_phone || bk.answers.length > 0) && (
                        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {bk.booker_phone ? <div><div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Phone</div><div style={{ fontSize: 12 }}>{bk.booker_phone}</div></div> : null}
                          {bk.answers.map((a, i) => <div key={i}><div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{a.label}</div><div style={{ fontSize: 12 }}>{a.value}</div></div>)}
                        </div>
                      )}
                      {bk.meet_url ? <a href={bk.meet_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#185FA5" }}>📹 Join Meet</a> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <SalesChatter contactCrmId={initialContact.id} contactName={initialContact.name} contactEmail={initialContact.email} staff={staff} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {([["all", "All"], ["call", "Calls"], ["note", "Notes"], ["task", "Tasks"], ["stage", "Stage changes"]] as const).map(([f, label]) => (
              <button key={f} onClick={() => setActFilter(f)} style={{ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 14, padding: "3px 11px", background: actFilter === f ? "#2E78F5" : "var(--muted)", color: actFilter === f ? "#fff" : "var(--muted-foreground)" }}>{label}</button>
            ))}
          </div>

          {/* Log a call */}
          <div style={{ background: "#F5F9FF", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><i className="ti ti-phone" aria-hidden="true" style={{ color: "#0F6E56" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>Log a call</span><span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>after your Nextiva call</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 2fr auto", gap: 8, alignItems: "center" }}>
              <select value={call.outcome} onChange={(e) => setCall({ ...call, outcome: e.target.value })} style={inp}><option value="connected">Connected</option><option value="voicemail">Voicemail</option><option value="no_answer">No answer</option><option value="wrong_number">Wrong number</option></select>
              <input value={call.duration} onChange={(e) => setCall({ ...call, duration: e.target.value })} placeholder="Duration" style={inp} />
              <input value={call.notes} onChange={(e) => setCall({ ...call, notes: e.target.value })} placeholder="Call notes / outcome…" style={inp} />
              <button onClick={logCall} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Log</button>
            </div>
          </div>

          {(() => {
            const shown = acts.filter((a) => actFilter === "all" || (actFilter === "task" ? a.kind.startsWith("task") : actFilter === "stage" ? (a.kind === "stage_changed" || a.kind === "won" || a.kind === "lost") : actFilter === "note" ? (a.kind === "note" || a.kind === "opp_note") : a.kind === actFilter));
            if (shown.length === 0) return <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>No activity yet. Calls, notes, tasks, stage changes, and conversions appear here.</div>;
            return (
              <div style={{ position: "relative", paddingLeft: 26 }}>
                <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 1.5, background: "var(--border)" }} />
                {shown.map((a) => {
                  const ic = ACT_ICON[a.kind] ?? { icon: "ti-point", color: "#5F5E5A", bg: "#F1EFE8" };
                  return (
                    <div key={a.id} style={{ position: "relative", marginBottom: 14 }}>
                      <span style={{ position: "absolute", left: -24, top: 1, width: 18, height: 18, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></span>
                      <div style={{ fontSize: 12 }}>{a.summary}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{a.actor_name ?? "System"} · {actWhen(a.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        )}

        {/* Linked opportunities */}
        {section === "details" && opportunities.length > 0 && (
          <div id="linked-opps" style={{ padding: "0 16px 16px", scrollMarginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Linked opportunities</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {opportunities.map((o) => (
                <button key={o.id} onClick={() => router.push(`/admin/sales/opportunities/${o.id}`)} style={{ textAlign: "left", background: "var(--muted)", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{o.title}</span>
                  <span style={{ fontSize: 11, color: "#185FA5" }}>{money(o.value_cents)}{o.probability != null ? ` · ${o.probability}%` : ""}{o.stage_name ? ` · ${o.stage_name}` : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
