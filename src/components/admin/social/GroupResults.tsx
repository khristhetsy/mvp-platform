"use client";

import { Fragment, useEffect, useState } from "react";
import type { GroupNetwork, ReviewTag } from "@/lib/social/group-share";

type Row = { id: string; network: GroupNetwork; name: string; posts: number; clicks: number; signups: number; meetings: number; removed: number; review: ReviewTag };
const TAG: Record<string, { label: string; cls: string }> = {
  keep: { label: "Keep", cls: "bg-emerald-100 text-emerald-800" },
  watch: { label: "Watch", cls: "bg-slate-100 text-slate-600" },
  drop: { label: "Drop?", cls: "bg-rose-100 text-rose-800" },
};
const CHANNELS: { network: GroupNetwork; label: string }[] = [{ network: "facebook", label: "Facebook groups" }, { network: "linkedin", label: "LinkedIn groups" }];

/** Attribution rows for group posts: a channel row per network that opens into each group. */
export function GroupResults() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ facebook: true });
  useEffect(() => {
    fetch("/api/admin/social/group-share?results=1&days=30").then((r) => (r.ok ? r.json() : { rows: null })).then((d) => setRows(d.rows ?? null)).catch(() => setRows(null));
  }, []);
  if (!rows || rows.length === 0) return null;
  const sum = (list: Row[], k: "clicks" | "signups" | "meetings") => list.reduce((a, r) => a + r[k], 0);
  return (
    <div>
      <div className="mb-2 text-[12.5px] font-semibold text-slate-800">Group posts · last 30 days</div>
      <table className="w-full max-w-2xl text-[12.5px]">
        <thead><tr className="border-b border-slate-200 text-right text-[10.5px] uppercase tracking-wide text-slate-500">
          <th className="py-1.5 text-left font-semibold">Channel</th><th className="font-semibold">Clicks</th><th className="font-semibold">Signups</th><th className="font-semibold">Mtgs</th><th className="font-semibold">Tag</th>
        </tr></thead>
        <tbody>
          {CHANNELS.map((c) => {
            const list = rows.filter((r) => r.network === c.network);
            if (list.length === 0) return null;
            return (
              <Fragment key={c.network}>
                <tr className="cursor-pointer border-t border-slate-100 text-right" onClick={() => setOpen((o) => ({ ...o, [c.network]: !o[c.network] }))}>
                  <td className="py-2 text-left font-semibold text-slate-800">{open[c.network] ? "▾" : "▸"} {c.label}</td>
                  <td>{sum(list, "clicks")}</td><td>{sum(list, "signups")}</td><td>{sum(list, "meetings")}</td><td />
                </tr>
                {open[c.network] ? list.map((r) => (
                  <tr key={r.id} className="border-t border-slate-50 bg-slate-50 text-right text-slate-600">
                    <td className="py-1.5 pl-5 text-left">{r.name}{r.removed ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{r.removed} removed</span> : null}</td>
                    <td>{r.clicks}</td><td>{r.signups}</td><td>{r.meetings}</td>
                    <td>{r.review ? <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TAG[r.review].cls}`}>{TAG[r.review].label}</span> : null}</td>
                  </tr>
                )) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 max-w-2xl text-[11.5px] text-slate-400">Clicks, signups and meetings come from each group&apos;s tracked link. No impressions, because neither network shares them for group posts. Keep, Watch and Drop? appear after 30 days or 3 posts per group.</p>
    </div>
  );
}

