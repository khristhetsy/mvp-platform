"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  STATUS_LABEL,
  awaitingApproval,
  countByStatus,
  filterScreenshots,
  founderVisible,
  screenshotStatus,
  type ScreenshotFilter,
  type ScreenshotRow,
  type ScreenshotStatus,
} from "@/lib/learning/coach/screenshots";

const FILTERS: Array<{ id: ScreenshotFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "captured", label: "Captured" },
  { id: "stale", label: "Stale" },
  { id: "missing", label: "Missing" },
  { id: "needs_fix", label: "Needs a fix" },
  { id: "awaiting", label: "Awaiting approval" },
];

const STATUS_STYLE: Record<ScreenshotStatus, string> = {
  captured: "text-green-700",
  stale: "text-amber-700",
  missing: "text-slate-500",
  needs_fix: "text-red-600",
};

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function ScreenshotStudio({ rows, urls }: Readonly<{ rows: ScreenshotRow[]; urls: Record<string, string> }>) {
  const router = useRouter();
  const [filter, setFilter] = useState<ScreenshotFilter>("all");
  const [selected, setSelected] = useState<string | null>(rows[0]?.step_key ?? null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const awaiting = useMemo(() => rows.filter(awaitingApproval).length, [rows]);
  const shown = useMemo(() => filterScreenshots(rows, filter), [rows, filter]);
  const sel = rows.find((r) => r.step_key === selected) ?? null;

  async function act(body: Record<string, unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/learning/coach/screenshots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setMessage(data.error ?? "Could not save.");
      return;
    }
    setMessage(done);
    setNote("");
    router.refresh();
  }

  const status = sel ? screenshotStatus(sel) : null;
  const candidateUrl = sel?.image_path ? urls[sel.image_path] : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-600">
          <li>A script you run yourself signs in as a demo founder account. It refuses any account that is not an @myicfos.com demo account.</li>
          <li>It opens each step&apos;s screen, finds the control by its learning id, blurs emails, phone numbers and amounts, and draws the numbered pin.</li>
          <li>Each image is saved with the app version and capture date. A screen that changed since you approved it shows as Stale.</li>
          <li>Founders only see an approved image of a screen that has not changed. Otherwise they see the written steps, as before.</li>
        </ol>
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">node scripts/coach-screenshots.mjs --requested</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{rows.length} steps in the course</span>
          <span className="rounded-md bg-green-50 px-2 py-0.5 font-semibold text-green-700">Captured {counts.captured}</span>
          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Stale {counts.stale}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Missing {counts.missing}</span>
          <span className="rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-600">Needs a fix {counts.needs_fix}</span>
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">Awaiting approval {awaiting}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-lg border px-3 py-1 text-xs font-medium ${filter === f.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || shown.length === 0}
            onClick={() => void act({ action: "request_capture", stepKeys: shown.map((r) => r.step_key) }, `Capture requested for ${shown.length} step(s). Your next script run picks them up.`)}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Request capture for shown ({shown.length})
          </button>
        </div>
        {message ? <p className="mt-2 text-xs text-slate-600" aria-live="polite">{message}</p> : null}

        <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
          {shown.map((r) => {
            const st = screenshotStatus(r);
            return (
              <li key={r.step_key}>
                <button
                  type="button"
                  onClick={() => setSelected(r.step_key)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${selected === r.step_key ? "bg-indigo-50" : ""}`}
                >
                  <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-slate-400">{r.step_index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{r.step_title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{r.menu_path.join(" › ")}</span>
                  </span>
                  {awaitingApproval(r) ? <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Review</span> : null}
                  {r.capture_requested_at ? <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Requested</span> : null}
                  <span className={`text-xs font-semibold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 ? <li className="px-3 py-6 text-center text-xs text-slate-400">No steps match this filter.</li> : null}
        </ul>
      </div>

      {sel && status ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            Step {sel.step_index + 1}: {sel.step_title}
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {candidateUrl ? (
              // Signed link to a private bucket, so next/image optimisation does not apply.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={candidateUrl} alt={`Latest capture of ${sel.step_title}`} className="block w-full" />
            ) : (
              <div className="px-4 py-10 text-center text-xs text-slate-500">
                {sel.capture_error ? "The last capture failed. See the error below." : "No image yet. Run the capture script, then refresh."}
              </div>
            )}
          </div>

          <table className="mt-3 w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {[
                ["Menu path", sel.menu_path.join(" › ")],
                ["Highlighted control", sel.control_label ?? "None. This step names no single control, so the image has no pin."],
                ["Route to visit", sel.route],
                ["Element to find", sel.learning_id ? `data-learning-id="${sel.learning_id}"` : "None"],
                ["Screen size", "1280 by 800"],
                ["Hidden before saving", "Emails, phone numbers, amounts"],
                ["Status", STATUS_LABEL[status]],
                ["Latest capture", sel.captured_at ? `${when(sel.captured_at)}, app version ${sel.app_version ?? "unknown"}${sel.pinned ? ", pinned" : ", no pin"}` : "None yet"],
                ["Shown to founders", founderVisible(sel) ? `Yes, approved ${when(sel.approved_at)} (capture of ${when(sel.approved_captured_at)})` : "No"],
                ...(sel.capture_error ? [["Capture error", sel.capture_error]] : []),
                ...(sel.needs_fix_note ? [["Fix note", sel.needs_fix_note]] : []),
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="w-44 py-1.5 pr-3 text-slate-500">{k}</td>
                  <td className="py-1.5 text-slate-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act({ action: "request_capture", stepKey: sel.step_key }, "Capture requested. Your next script run picks it up.")}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Request capture
            </button>
            <button
              type="button"
              disabled={busy || !awaitingApproval(sel)}
              onClick={() => void act({ action: "approve", stepKey: sel.step_key }, "Approved. Founders see this image.")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Approve image
            </button>
            {sel.needs_fix ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ action: "unflag", stepKey: sel.step_key }, "Flag cleared.")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Clear needs a fix
              </button>
            ) : (
              <>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="What needs fixing (optional)"
                  aria-label="Fix note"
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: "flag", stepKey: sel.step_key, note }, "Marked as needing a fix. Founders no longer see its image.")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Mark needs a fix
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
