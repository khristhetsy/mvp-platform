"use client";

import { useState } from "react";
import type { CampaignWithStats } from "@/lib/linkedin/store";
import { ErrorLine, Section, Tag, api, btnCls, primaryCls } from "./ui";

const STATUS: Record<CampaignWithStats["status"], { label: string; tone: "ok" | "warn" | "mute" | "bad" }> = {
  draft: { label: "Draft", tone: "mute" },
  pending_approval: { label: "Needs approval", tone: "warn" },
  ready: { label: "Queued", tone: "ok" },
  running: { label: "Running", tone: "ok" },
  paused: { label: "Paused", tone: "warn" },
  completed: { label: "Done", tone: "mute" },
  stopped: { label: "Stopped", tone: "bad" },
};

export function CampaignsTab({ campaigns, onNew, onChanged }: Readonly<{ campaigns: CampaignWithStats[]; onNew: () => void; onChanged: () => void }>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needApproval = campaigns.filter((c) => c.needs_approval && c.status !== "stopped" && c.status !== "completed");

  async function act(id: string, action: "approve" | "start" | "pause" | "resume" | "stop") {
    setBusy(`${id}:${action}`); setError(null);
    const r = await api(`/api/admin/linkedin/campaigns/${id}`, "POST", { action });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <Section title="Your campaigns" icon="ti-brand-linkedin" action={<button type="button" className={primaryCls} onClick={onNew}>+ New campaign</button>}>
        <p className="px-4 pt-3 text-[12.5px] text-slate-500">You only step in when something needs you. The automatic sender is not connected yet, so a started campaign queues people and makes tasks for invites you send by hand.</p>
        {campaigns.length === 0 ? <p className="px-4 py-6 text-[13px] text-slate-600">No campaigns yet. Start with New campaign.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-slate-500"><tr><th className="px-4 py-2 font-medium">Campaign</th><th className="px-2 py-2 font-medium">People</th><th className="px-2 py-2 font-medium">Invited</th><th className="px-2 py-2 font-medium">Accepted</th><th className="px-2 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
              <tbody>
                {campaigns.map((c) => {
                  const s = STATUS[c.status];
                  const approved = !c.needs_approval;
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                      <td className="px-2 py-2.5">{c.people}</td>
                      <td className="px-2 py-2.5">{c.invited}</td>
                      <td className="px-2 py-2.5">{c.accepted}</td>
                      <td className="px-2 py-2.5"><Tag tone={s.tone}>{s.label}</Tag></td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap justify-end gap-2">
                          {!approved && c.status !== "stopped" && c.status !== "completed" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "approve")}>Approve wording</button> : null}
                          {approved && (c.status === "draft" || c.status === "pending_approval") ? <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => act(c.id, "start")}>Start</button> : null}
                          {c.status === "ready" || c.status === "running" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "pause")}>Pause</button> : null}
                          {c.status === "paused" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "start")}>Resume</button> : null}
                          {c.status !== "stopped" && c.status !== "completed" && c.status !== "draft" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "stop")}>Stop</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-3"><ErrorLine text={error} /></div>
      </Section>
      {needApproval.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px]">
          <b className="text-amber-900">{needApproval.length === 1 ? "1 thing needs you" : `${needApproval.length} things need you`}</b>
          <p className="text-[12.5px] text-amber-800">Approve the wording for {needApproval.map((c) => `"${c.name}"`).join(", ")} before it can start. Nothing sends unapproved text.</p>
        </div>
      ) : null}
    </div>
  );
}
