"use client";

import { useState } from "react";
import type { CompanyUpdateRecord } from "@/lib/company-updates/types";

const UPDATE_TYPES = [
  { value: "milestone",       label: "Milestone" },
  { value: "fundraising",     label: "Fundraising" },
  { value: "product",         label: "Product" },
  { value: "financial",       label: "Financial" },
  { value: "operational",     label: "Operational" },
  { value: "investor_update", label: "Investor update" },
] as const;

const VISIBILITY_OPTIONS = [
  {
    value: "interested_investors",
    label: "Investors engaged with you",
    description: "Notifies investors who saved, expressed interest, or requested an intro",
  },
  {
    value: "marketplace",
    label: "All approved investors",
    description: "Visible to every approved investor on the platform",
  },
  {
    value: "draft",
    label: "Draft (save only)",
    description: "Saved but not published — no notifications sent",
  },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function typeLabel(val: string) {
  return UPDATE_TYPES.find((t) => t.value === val)?.label ?? val;
}

export function FounderCompanyUpdatesClient({
  initialUpdates,
}: {
  initialUpdates: CompanyUpdateRecord[];
}) {
  const [updates, setUpdates] = useState<CompanyUpdateRecord[]>(initialUpdates);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [updateType, setUpdateType] = useState<string>("investor_update");
  const [visibility, setVisibility] = useState<string>("interested_investors");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const publishNow = visibility !== "draft";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/founder/company-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          updateType,
          visibility,
          publish: publishNow,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((json.error as string) ?? `HTTP ${res.status}`);
      }
      const newUpdate = json.update as CompanyUpdateRecord;
      setUpdates((v) => [newUpdate, ...v]);
      setTitle("");
      setBody("");
      setUpdateType("investor_update");
      setVisibility("interested_investors");
      setShowForm(false);
      setSuccessMsg(
        publishNow
          ? "Update published — investors are being notified."
          : "Draft saved. Publish it when you're ready.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save update.");
    } finally {
      setSubmitting(false);
    }
  }

  const published = updates.filter((u) => u.published_at);
  const drafts = updates.filter((u) => !u.published_at);

  return (
    <div className="space-y-6">
      {/* Success / error banners */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Compose button / form */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => { setShowForm(true); setSuccessMsg(null); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 py-5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Compose new update
        </button>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm"
        >
          <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-3">
            <p className="text-sm font-semibold text-indigo-900">New investor update</p>
          </div>
          <div className="space-y-4 p-5">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="upd-title">
                Title
              </label>
              <input
                id="upd-title"
                required
                minLength={3}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 'We crossed $100K ARR' or 'New enterprise customer signed'"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Body */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="upd-body">
                Body
              </label>
              <textarea
                id="upd-body"
                required
                minLength={10}
                maxLength={8000}
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share the details — what happened, what it means, what's next…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">{body.length} / 8000</p>
            </div>

            {/* Type + visibility row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="upd-type">
                  Update type
                </label>
                <select
                  id="upd-type"
                  value={updateType}
                  onChange={(e) => setUpdateType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {UPDATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="upd-visibility">
                  Audience
                </label>
                <select
                  id="upd-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {VISIBILITY_OPTIONS.find((v) => v.value === visibility)?.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || body.trim().length < 10}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : publishNow
                ? "Publish & notify investors"
                : "Save draft"}
            </button>
          </div>
        </form>
      )}

      {/* Published updates */}
      {published.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Published ({published.length})
          </h2>
          <div className="space-y-3">
            {published.map((u) => (
              <div
                key={u.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{u.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {typeLabel(u.update_type)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          u.visibility === "marketplace"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {u.visibility === "marketplace" ? "All investors" : "Engaged investors"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Published {formatDate(u.published_at)}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-5 py-3">
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{u.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Drafts ({drafts.length})
          </h2>
          <div className="space-y-2">
            {drafts.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700">{u.title}</p>
                  <p className="text-xs text-slate-400">
                    {typeLabel(u.update_type)} · Saved {formatDate(u.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  Draft
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {updates.length === 0 && !showForm && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No updates yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Published updates notify investors watching your company.
          </p>
        </div>
      )}
    </div>
  );
}
