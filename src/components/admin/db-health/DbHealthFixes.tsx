"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LongQuery } from "@/lib/db-health/load";

export type FixJob = { path: string; name: string; timeouts: number; paused: boolean };

const SUPABASE_COMPUTE = "https://supabase.com/dashboard/project/raowjbhbtmwkycmwvavd/settings/compute-and-disk";
const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

/**
 * Fixes the page can run, each one confirmed and written to the audit log by its API.
 * Pause and Run now use the Scheduled jobs APIs, so a job is paused the same way everywhere.
 */
export function DbHealthFixes({
  longQueries,
  queryLimitS,
  jobs,
}: Readonly<{ longQueries: LongQuery[] | null; queryLimitS: number; jobs: FixJob[] }>) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(key: string, url: string, body: unknown, done: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "That didn't work. Try again." });
      else if (j.cancelled === false) setMsg({ ok: false, text: typeof j.reason === "string" ? j.reason : "Nothing was cancelled." });
      else setMsg({ ok: true, text: done });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {msg ? (
        <p role="status" className={`px-4 py-2 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>
      ) : null}

      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Cancel a long query</p>
        {longQueries === null ? (
          <p className="mt-1 text-xs text-slate-500">Not measured. Run the Database health SQL (part 2) in the Supabase SQL editor to turn this on.</p>
        ) : longQueries.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No query has been running for 5 seconds or more right now.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {longQueries.map((q) => (
              <li key={q.pid} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${q.seconds >= queryLimitS ? "text-red-700" : "text-slate-700"}`}>Running {Math.round(q.seconds)} s</p>
                  <p className="truncate font-mono text-[11px] text-slate-500" title={q.query}>{q.query}</p>
                </div>
                {confirming === `q${q.pid}` ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={busy !== null} onClick={() => call(`q${q.pid}`, "/api/admin/db-health/cancel-query", { pid: q.pid }, "Query cancelled.")} className={`${btn} border-red-300 bg-red-600 text-white`}>Confirm cancel</button>
                    <button type="button" onClick={() => setConfirming(null)} className={`${btn} border-slate-200 text-slate-700`}>Keep it</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(`q${q.pid}`)} className={`${btn} border-red-300 text-red-700`}>Cancel</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Scheduled jobs that timed out</p>
        {jobs.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No job timed out in the last 24 hours. <Link href="/admin/scheduled-jobs" className="font-semibold text-indigo-700 hover:underline">Open Scheduled jobs</Link></p>
        ) : (
          <ul className="mt-2 space-y-2">
            {jobs.map((j) => (
              <li key={j.path} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{j.name}</p>
                  <p className="text-[11px] text-slate-500">{j.timeouts} timeout{j.timeouts === 1 ? "" : "s"} in 24 hours{j.paused ? ", paused" : ""}</p>
                </div>
                <span className="flex gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => call(`p${j.path}`, "/api/admin/scheduled-jobs", { paths: [j.path], paused: !j.paused }, j.paused ? `${j.name} resumed.` : `${j.name} paused. It still wakes up on schedule and skips its work.`)} className={`${btn} border-slate-200 text-slate-700`}>{j.paused ? "Resume" : "Pause"}</button>
                  <button type="button" disabled={busy !== null || j.paused} onClick={() => call(`r${j.path}`, "/api/admin/scheduled-jobs/schedule", { action: "run-now", job: j.path }, `${j.name} started.`)} className={`${btn} border-indigo-300 text-indigo-700`}>Run now</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Add database capacity</p>
          <p className="text-xs text-slate-500">Opens your Supabase compute settings. The database restarts, so pick a quiet hour.</p>
        </div>
        <a href={SUPABASE_COMPUTE} target="_blank" rel="noopener noreferrer" className={`${btn} border-slate-200 text-slate-700`}>Open Supabase</a>
      </div>
    </div>
  );
}
