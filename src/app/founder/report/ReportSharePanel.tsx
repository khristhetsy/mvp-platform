"use client";

import { useState } from "react";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";
import type { ShareSummary } from "@/lib/reports/report-shares";

/**
 * "Use your report with any investor": secure share links to the founder's
 * latest diligence report. Create a link, copy it, see how often it was opened,
 * and turn it off. The PDF download lives in the report header above, so it
 * is not repeated here.
 */
export function ReportSharePanel({
  initialShares,
  appOrigin,
}: Readonly<{ initialShares: ShareSummary[]; appOrigin: string }>) {
  const [shares, setShares] = useState<ShareSummary[]>(initialShares);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const urlFor = (token: string) => `${appOrigin.replace(/\/$/, "")}/share/report/${token}`;

  async function call(method: "POST" | "PATCH", body: Record<string, unknown>, key: string) {
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch("/api/founder/report/shares", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => null)) as { error?: string; shares?: ShareSummary[] } | null;
      if (!res.ok) throw new Error(j?.error ?? "Something went wrong. Please try again.");
      if (j?.shares) setShares(j.shares);
      if (method === "POST") setLabel("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(share: ShareSummary) {
    try {
      await navigator.clipboard.writeText(urlFor(share.token));
      setCopied(share.id);
      setTimeout(() => setCopied((c) => (c === share.id ? null : c)), 2000);
    } catch {
      setErr("Copy is blocked in this browser. Select the link and copy it by hand.");
    }
  }

  const active = shares.filter((s) => !s.revoked_at).length;

  return (
    <WorkspacePanel
      title="Use your report with any investor"
      subtitle="Create a secure link to this report for any prospective investor. They read it without signing in, you see when it is opened, and you can turn a link off at any time."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {shares.length ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {active} active of {shares.length}
            </span>
          ) : null}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="Who is it for? (optional)"
            aria-label="Who is this link for"
            className="w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void call("POST", { label }, "create")}
            disabled={busy !== null}
            className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {busy === "create" ? "Creating…" : "Create link"}
          </button>
        </div>
      }
    >
      {err ? <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p> : null}
      {shares.length === 0 ? (
        <p className="text-sm text-slate-600">No links yet. Create one for each investor so you can see who opened it.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shares.map((s) => {
            const off = Boolean(s.revoked_at);
            return (
              <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {s.label || "Share link"}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      created {formatPlatformDateTime(s.created_at, { dateStyle: "medium" })}
                    </span>
                    {off ? (
                      <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Turned off</span>
                    ) : null}
                  </p>
                  {off ? null : (
                    <input
                      readOnly
                      value={urlFor(s.token)}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Share link"
                      className="mt-1 w-full max-w-xl rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700"
                    />
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {s.views} {s.views === 1 ? "view" : "views"}, {s.downloads} {s.downloads === 1 ? "download" : "downloads"}.{" "}
                    {s.lastOpenedAt ? `Last opened ${formatPlatformDateTime(s.lastOpenedAt)}` : "Not opened yet"}
                  </p>
                </div>
                {off ? null : (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void call("PATCH", { id: s.id }, s.id)}
                      disabled={busy !== null}
                      className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
                    >
                      {busy === s.id ? "Turning off…" : "Turn off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(s)}
                      className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2E78F5]"
                    >
                      {copied === s.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WorkspacePanel>
  );
}
