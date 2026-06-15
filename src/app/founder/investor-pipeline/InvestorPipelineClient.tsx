"use client";

import { useState } from "react";

type MeetingStatus = "none" | "requested" | "scheduled";
type OutreachStatus = "not_started" | "contacted" | "in_progress" | "closed";

interface PipelineInvestor {
  id: string;
  founder_id: string;
  name: string;
  location: string | null;
  investor_type: string;
  investment_size: string | null;
  pledge_amount: number | null;
  interested: boolean;
  meeting_requested: MeetingStatus;
  match_score: number | null;
  outreach_status: OutreachStatus;
  preferred_stages: string[] | null;
  focus_sectors: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const INVESTOR_TYPES = [
  "Venture Capital",
  "Angel Syndicate",
  "Family Office",
  "Strategic / Corporate",
];

const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  not_started: "Not Started",
  contacted: "Contacted",
  in_progress: "In Progress",
  closed: "Closed",
};

const MEETING_LABELS: Record<MeetingStatus, string> = {
  none: "None",
  requested: "Requested",
  scheduled: "Scheduled",
};

const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+"];
const SECTOR_OPTIONS = [
  "Fintech", "SaaS", "HealthTech", "EdTech", "CleanTech",
  "AI / ML", "PropTech", "Consumer", "B2B", "Other",
];

// ─── Badge sub-components ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "Venture Capital": "bg-blue-50 text-blue-700 border-blue-200",
    "Angel Syndicate": "bg-purple-50 text-purple-700 border-purple-200",
    "Family Office": "bg-amber-50 text-amber-700 border-amber-200",
    "Strategic / Corporate": "bg-teal-50 text-teal-700 border-teal-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap ${colors[type] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {type}
    </span>
  );
}

function OutreachBadge({
  status,
  editable,
  onChange,
}: {
  status: OutreachStatus;
  editable?: boolean;
  onChange?: (s: OutreachStatus) => void;
}) {
  const colors: Record<OutreachStatus, string> = {
    not_started: "bg-slate-50 text-slate-600 border-slate-200",
    contacted: "bg-blue-50 text-blue-700 border-blue-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  if (editable && onChange) {
    return (
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as OutreachStatus)}
        className={`inline-flex items-center pl-2 pr-1 py-0.5 text-xs font-medium border rounded-md cursor-pointer ${colors[status]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(Object.keys(OUTREACH_LABELS) as OutreachStatus[]).map((s) => (
          <option key={s} value={s}>
            {OUTREACH_LABELS[s]}
          </option>
        ))}
      </select>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${colors[status]}`}
    >
      {OUTREACH_LABELS[status]}
    </span>
  );
}

function MeetingBadge({ status }: { status: MeetingStatus }) {
  const colors: Record<MeetingStatus, string> = {
    none: "bg-slate-50 text-slate-500 border-slate-200",
    requested: "bg-blue-50 text-blue-700 border-blue-200",
    scheduled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${colors[status]}`}
    >
      {MEETING_LABELS[status]}
    </span>
  );
}

function MatchBar({ score }: { score: number | null }) {
  if (score === null || score === undefined)
    return <span className="text-xs text-slate-400">—</span>;
  const color =
    score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#94a3b8";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span
        className="text-xs font-semibold"
        style={{ color, minWidth: "2rem", textAlign: "right" }}
      >
        {score}%
      </span>
    </div>
  );
}

// ─── Form blank ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  location: "",
  investor_type: "Venture Capital",
  investment_size: "",
  pledge_amount: "",
  interested: false,
  meeting_requested: "none" as MeetingStatus,
  match_score: "",
  outreach_status: "not_started" as OutreachStatus,
  preferred_stages: [] as string[],
  focus_sectors: [] as string[],
  notes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function InvestorPipelineClient({
  initialData,
}: {
  initialData: PipelineInvestor[];
}) {
  const [investors, setInvestors] = useState<PipelineInvestor[]>(initialData);
  const [search, setSearch] = useState("");
  const [outreachFilter, setOutreachFilter] = useState<OutreachStatus | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [profileOf, setProfileOf] = useState<PipelineInvestor | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = investors.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.name.toLowerCase().includes(q) ||
      (inv.location ?? "").toLowerCase().includes(q) ||
      inv.investor_type.toLowerCase().includes(q);
    const matchOutreach =
      outreachFilter === "all" || inv.outreach_status === outreachFilter;
    return matchSearch && matchOutreach;
  });

  const stats = {
    total: investors.length,
    interested: investors.filter((i) => i.interested).length,
    meetings: investors.filter((i) => i.meeting_requested !== "none").length,
    inProgress: investors.filter((i) => i.outreach_status === "in_progress").length,
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function refresh() {
    const r = await fetch("/api/founder/investor-pipeline");
    if (r.ok) {
      const d = await r.json();
      setInvestors(d.investors ?? []);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(inv: PipelineInvestor) {
    setEditingId(inv.id);
    setForm({
      name: inv.name,
      location: inv.location ?? "",
      investor_type: inv.investor_type,
      investment_size: inv.investment_size ?? "",
      pledge_amount: inv.pledge_amount != null ? String(inv.pledge_amount) : "",
      interested: inv.interested,
      meeting_requested: inv.meeting_requested,
      match_score: inv.match_score != null ? String(inv.match_score) : "",
      outreach_status: inv.outreach_status,
      preferred_stages: inv.preferred_stages ?? [],
      focus_sectors: inv.focus_sectors ?? [],
      notes: inv.notes ?? "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError("Investor name is required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      location: form.location || null,
      investor_type: form.investor_type,
      investment_size: form.investment_size || null,
      pledge_amount: form.pledge_amount ? parseFloat(form.pledge_amount) : null,
      interested: form.interested,
      meeting_requested: form.meeting_requested,
      match_score: form.match_score ? parseInt(form.match_score) : null,
      outreach_status: form.outreach_status,
      preferred_stages: form.preferred_stages,
      focus_sectors: form.focus_sectors,
      notes: form.notes || null,
    };
    const url = editingId
      ? `/api/founder/investor-pipeline/${editingId}`
      : "/api/founder/investor-pipeline";
    const method = editingId ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json();
      setFormError(d.error ?? "Save failed.");
      return;
    }
    closeModal();
    refresh();
  }

  async function handleOutreachChange(id: string, status: OutreachStatus) {
    setInvestors((prev) =>
      prev.map((i) => (i.id === id ? { ...i, outreach_status: status } : i))
    );
    await fetch(`/api/founder/investor-pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreach_status: status }),
    });
  }

  function exportCSV() {
    const cols: (keyof PipelineInvestor)[] = [
      "name", "location", "investor_type", "investment_size",
      "pledge_amount", "interested", "meeting_requested",
      "match_score", "outreach_status", "preferred_stages",
      "focus_sectors", "notes",
    ];
    const header = cols.join(",");
    const rows = investors.map((inv) =>
      cols
        .map((c) => {
          const val = inv[c];
          if (Array.isArray(val)) return `"${val.join("; ")}"`;
          if (val === null || val === undefined) return "";
          if (typeof val === "boolean") return val ? "Yes" : "No";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "investor-pipeline.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const toggleStage = (s: string) =>
    setForm((f) => ({
      ...f,
      preferred_stages: f.preferred_stages.includes(s)
        ? f.preferred_stages.filter((x) => x !== s)
        : [...f.preferred_stages, s],
    }));

  const toggleSector = (s: string) =>
    setForm((f) => ({
      ...f,
      focus_sectors: f.focus_sectors.includes(s)
        ? f.focus_sectors.filter((x) => x !== s)
        : [...f.focus_sectors, s],
    }));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: "Total Investors", value: stats.total },
            { label: "Interested", value: stats.interested },
            { label: "Meetings", value: stats.meetings },
            { label: "In Progress", value: stats.inProgress },
          ] as const
        ).map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-panel)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-2xl font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search investors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
        />
        <select
          value={outreachFilter}
          onChange={(e) =>
            setOutreachFilter(e.target.value as OutreachStatus | "all")
          }
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
        >
          <option value="all">All Outreach</option>
          {(Object.keys(OUTREACH_LABELS) as OutreachStatus[]).map((s) => (
            <option key={s} value={s}>
              {OUTREACH_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={exportCSV}
          className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
        >
          Export CSV
        </button>
        <button onClick={openAdd} className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
          + Add Investor
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-panel)" }}
      >
        <div className="overflow-x-auto">
          <table className="enterprise-table enterprise-table--comfortable w-full border-collapse bg-white">
            <thead>
              <tr>
                {["Investor", "Type", "Investment Size", "Pledged", "Interested", "Meeting", "Match", "Outreach", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {investors.length === 0
                      ? "Add your first investor to get started."
                      : "No investors match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    {/* Investor */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setProfileOf(inv)}
                        className="text-sm font-semibold text-left hover:underline"
                        style={{ color: "var(--blue)" }}
                      >
                        {inv.name}
                      </button>
                      {inv.location && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {inv.location}
                        </p>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <TypeBadge type={inv.investor_type} />
                    </td>
                    {/* Investment Size */}
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {inv.investment_size ?? "—"}
                    </td>
                    {/* Pledged */}
                    <td className="px-4 py-3 text-sm font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {inv.pledge_amount != null
                        ? `$${inv.pledge_amount.toLocaleString()}`
                        : "—"}
                    </td>
                    {/* Interested */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md ${
                          inv.interested
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        {inv.interested ? "Yes" : "No"}
                      </span>
                    </td>
                    {/* Meeting */}
                    <td className="px-4 py-3">
                      <MeetingBadge status={inv.meeting_requested} />
                    </td>
                    {/* Match */}
                    <td className="px-4 py-3">
                      <MatchBar score={inv.match_score} />
                    </td>
                    {/* Outreach */}
                    <td className="px-4 py-3">
                      <OutreachBadge
                        status={inv.outreach_status}
                        editable
                        onChange={(s) => handleOutreachChange(inv.id, s)}
                      />
                    </td>
                    {/* Edit */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(inv)}
                        title="Edit"
                        className="rounded-md p-1.5 transition-colors hover:bg-slate-100"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Profile popup ──────────────────────────────────────────────────────── */}
      {profileOf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(12,35,64,0.35)" }}
          onClick={() => setProfileOf(null)}
        >
          <div
            className="relative rounded-2xl bg-white w-full max-w-md mx-4 shadow-2xl enterprise-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between p-6 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {profileOf.name}
                </h3>
                {profileOf.location && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {profileOf.location}
                  </p>
                )}
              </div>
              <button
                onClick={() => setProfileOf(null)}
                className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Investor Type", node: <TypeBadge type={profileOf.investor_type} /> },
                  { label: "Investment Size", node: <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{profileOf.investment_size ?? "—"}</span> },
                  { label: "Amount Pledged", node: <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>{profileOf.pledge_amount != null ? `$${profileOf.pledge_amount.toLocaleString()}` : "—"}</span> },
                  { label: "Match Score", node: <MatchBar score={profileOf.match_score} /> },
                  { label: "Outreach Status", node: <OutreachBadge status={profileOf.outreach_status} /> },
                  { label: "Meeting Status", node: <MeetingBadge status={profileOf.meeting_requested} /> },
                ].map(({ label, node }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                      {label}
                    </p>
                    {node}
                  </div>
                ))}
              </div>

              {profileOf.preferred_stages && profileOf.preferred_stages.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                    Preferred Stages
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profileOf.preferred_stages.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-600 border border-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profileOf.focus_sectors && profileOf.focus_sectors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                    Focus Sectors
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profileOf.focus_sectors.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-600 border border-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profileOf.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{profileOf.notes}</p>
                </div>
              )}

              {/* Security notice */}
              <div
                className="rounded-lg border p-3 flex gap-2.5 items-start"
                style={{ borderColor: "var(--border-subtle)", background: "var(--surface-sunken)" }}
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Contact details are managed by CapitalOS and are not displayed here. Use the platform&apos;s outreach tools to connect with this investor.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(12,35,64,0.35)" }}
          onClick={closeModal}
        >
          <div
            className="relative rounded-2xl bg-white w-full max-w-lg mx-4 shadow-2xl flex flex-col enterprise-animate-in"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {editingId ? "Edit Investor" : "Add Investor"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                    Investor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Sequoia Capital"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Location</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Investor Type</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.investor_type}
                    onChange={(e) => setForm((f) => ({ ...f, investor_type: e.target.value }))}
                  >
                    {INVESTOR_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Investment Size */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Investment Size</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.investment_size}
                    onChange={(e) => setForm((f) => ({ ...f, investment_size: e.target.value }))}
                    placeholder="e.g. $250K – $1M"
                  />
                </div>

                {/* Pledge */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Pledge Amount ($)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.pledge_amount}
                    onChange={(e) => setForm((f) => ({ ...f, pledge_amount: e.target.value }))}
                    placeholder="250000"
                  />
                </div>

                {/* Match Score */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Match Score (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.match_score}
                    onChange={(e) => setForm((f) => ({ ...f, match_score: e.target.value }))}
                    placeholder="75"
                  />
                </div>

                {/* Outreach */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Outreach Status</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.outreach_status}
                    onChange={(e) => setForm((f) => ({ ...f, outreach_status: e.target.value as OutreachStatus }))}
                  >
                    {(Object.keys(OUTREACH_LABELS) as OutreachStatus[]).map((s) => (
                      <option key={s} value={s}>{OUTREACH_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Meeting */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Meeting Status</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.meeting_requested}
                    onChange={(e) => setForm((f) => ({ ...f, meeting_requested: e.target.value as MeetingStatus }))}
                  >
                    {(Object.keys(MEETING_LABELS) as MeetingStatus[]).map((s) => (
                      <option key={s} value={s}>{MEETING_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Interested toggle */}
                <div className="col-span-2 flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Interested</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, interested: !f.interested }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.interested ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.interested ? "translate-x-[18px]" : "translate-x-[2px]"}`}
                    />
                  </button>
                </div>

                {/* Preferred stages */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Preferred Stages</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStage(s)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                          form.preferred_stages.includes(s)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus sectors */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Focus Sectors</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SECTOR_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSector(s)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                          form.focus_sectors.includes(s)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Notes</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any context about this investor…"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div
              className="flex items-center justify-end gap-3 p-6 border-t"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <button
                onClick={closeModal}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="cap-btn-primary rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Saving…" : editingId ? "Save Changes" : "Add Investor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
