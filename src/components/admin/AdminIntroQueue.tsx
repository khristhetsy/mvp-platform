"use client";

import { useState, useCallback } from "react";

type IntroStatus = "requested" | "reviewing" | "facilitated" | "declined";

type IntroRow = {
  id: string;
  status?: string | null;
  message?: string | null;
  created_at?: string;
  profiles?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
  companies?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null;
};

function resolveProfile(profiles: IntroRow["profiles"]): { name: string; email: string | null } {
  if (!profiles) return { name: "Unknown", email: null };
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return { name: p?.full_name ?? p?.email ?? "Unknown", email: p?.email ?? null };
}

function resolveCompany(companies: IntroRow["companies"]): string {
  if (!companies) return "Unknown company";
  const c = Array.isArray(companies) ? companies[0] : companies;
  return c?.company_name ?? "Unknown company";
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  requested:   { bg: "#EFF6FF", text: "#1d4ed8", label: "Requested" },
  reviewing:   { bg: "#FEF9C3", text: "#854d0e", label: "Reviewing" },
  facilitated: { bg: "#F0FDF4", text: "#15803d", label: "Facilitated" },
  declined:    { bg: "#FEF2F2", text: "#dc2626", label: "Declined" },
};

type Props = { introRequests: Array<Record<string, unknown>> };

export function AdminIntroQueue({ introRequests }: Props) {
  const [statuses, setStatuses] = useState<Record<string, IntroStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getStatus = (row: IntroRow): IntroStatus => {
    return (statuses[row.id] ?? row.status ?? "requested") as IntroStatus;
  };

  const advance = useCallback(async (id: string, newStatus: IntroStatus) => {
    setBusy((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const res = await fetch(`/api/admin/intro-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note: notes[id] ?? null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatuses((prev) => ({ ...prev, [id]: newStatus }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }, [notes]);

  if (introRequests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">No intro requests yet</p>
        <p className="mt-1 text-xs text-slate-400">Requests appear here when investors submit them.</p>
      </div>
    );
  }

  // Sort: pending first
  const rows = [...introRequests]
    .map((r) => r as IntroRow)
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { requested: 0, reviewing: 1, facilitated: 2, declined: 3 };
      const sa = statusOrder[getStatus(a)] ?? 0;
      const sb = statusOrder[getStatus(b)] ?? 0;
      return sa - sb;
    });

  const pendingCount = rows.filter((r) => {
    const s = getStatus(r);
    return s === "requested" || s === "reviewing";
  }).length;

  return (
    <div className="space-y-3">
      {/* Header stat */}
      <div className="flex items-center gap-2">
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {pendingCount} pending action{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {rows.length} total
        </span>
      </div>

      {rows.map((row) => {
        const status = getStatus(row);
        const style = STATUS_STYLES[status] ?? STATUS_STYLES.requested;
        const { name, email } = resolveProfile(row.profiles);
        const company = resolveCompany(row.companies);
        const isPending = status === "requested" || status === "reviewing";
        const isBusy = busy[row.id] ?? false;

        return (
          <div
            key={row.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${isPending ? "border-slate-200" : "border-slate-100 opacity-80"}`}
          >
            {/* Top row */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <span
                    style={{ background: style.bg, color: style.text }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  >
                    {style.label}
                  </span>
                </div>
                {email && <p className="text-[11px] text-slate-400">{email}</p>}
                <p className="mt-0.5 text-xs text-slate-600">→ {company}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(row.created_at)}</p>
              </div>

              {/* Action buttons — only shown for pending */}
              {isPending && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {status === "requested" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void advance(row.id, "reviewing")}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition"
                    >
                      Start review
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void advance(row.id, "facilitated")}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition"
                  >
                    {isBusy ? "Saving…" : "Facilitate"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void advance(row.id, "declined")}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>

            {/* Message */}
            {row.message && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-600">
                &ldquo;{row.message}&rdquo;
              </p>
            )}

            {/* Note input — only for pending */}
            {isPending && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Optional facilitator note (sent with notification)…"
                  value={notes[row.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            {/* Error */}
            {errors[row.id] && (
              <p className="mt-2 text-[11px] font-medium text-red-600">{errors[row.id]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
