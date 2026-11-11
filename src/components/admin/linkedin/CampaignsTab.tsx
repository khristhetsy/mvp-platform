"use client";

import { useState } from "react";
import type { CampaignWithStats } from "@/lib/linkedin/store";
import { ErrorLine, Modal, Section, Tag, api, btnCls, dangerCls, primaryCls } from "./ui";

const STATUS: Record<CampaignWithStats["status"], { label: string; tone: "ok" | "warn" | "mute" | "bad" }> = {
  draft: { label: "Draft", tone: "mute" },
  pending_approval: { label: "Needs approval", tone: "warn" },
  ready: { label: "Queued", tone: "ok" },
  running: { label: "Running", tone: "ok" },
  paused: { label: "Paused", tone: "warn" },
  completed: { label: "Done", tone: "mute" },
  stopped: { label: "Stopped", tone: "bad" },
};

/** Mirrors canRemoveCampaign in the store: a campaign that is working or waiting to send must be stopped first. */
const REMOVABLE = new Set<CampaignWithStats["status"]>(["draft", "pending_approval", "stopped", "completed"]);

export function CampaignsTab({ campaigns, onNew, onChanged }: Readonly<{ campaigns: CampaignWithStats[]; onNew: () => void; onChanged: () => void }>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [confirmDelete, setConfirmDelete] = useState<CampaignWithStats | null>(null);
  const [note, setNote] = useState<{ text: string; undoId: string | null } | null>(null);
  const active = campaigns.filter((c) => !c.archived_at);
  const archived = campaigns.filter((c) => c.archived_at);
  const shown = view === "active" ? active : archived;
  const needApproval = active.filter((c) => c.needs_approval && c.status !== "stopped" && c.status !== "completed");

  async function act(id: string, action: "approve" | "start" | "pause" | "resume" | "stop" | "archive" | "restore", done?: { text: string; undoId: string | null }) {
    setBusy(`${id}:${action}`); setError(null);
    const r = await api(`/api/admin/linkedin/campaigns/${id}`, "POST", { action });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setNote(done ?? null);
    onChanged();
  }

  async function remove(c: CampaignWithStats) {
    setBusy(`${c.id}:delete`); setError(null);
    const r = await api(`/api/admin/linkedin/campaigns/${c.id}`, "DELETE");
    setBusy(null);
    setConfirmDelete(null);
    if (!r.ok) { setError(r.error); return; }
    setNote({ text: `${c.name} deleted.`, undoId: null });
    onChanged();
  }

  const tabCls = (on: boolean) => `rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${on ? "border-[#1A6CE4] bg-[#EEF4FF] text-[#1A6CE4]" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <div className="space-y-4">
      <Section title="Your campaigns" icon="ti-brand-linkedin" action={<button type="button" className={primaryCls} onClick={onNew}>+ New campaign</button>}>
        <div className="flex gap-2 px-4 pt-3">
          <button type="button" className={tabCls(view === "active")} aria-pressed={view === "active"} onClick={() => setView("active")}>Active ({active.length})</button>
          <button type="button" className={tabCls(view === "archived")} aria-pressed={view === "archived"} onClick={() => setView("archived")}>Archived ({archived.length})</button>
        </div>
        <p className="px-4 pt-3 text-[12.5px] text-slate-500">{view === "active" ? "You only step in when something needs you. The automatic sender is not connected yet, so a started campaign queues people and makes tasks for invites you send by hand. Archive hides a campaign and keeps its data. Delete removes it for good." : "Archived campaigns are kept but hidden. Restore one to use it again, or delete it for good."}</p>
        {shown.length === 0 ? <p className="px-4 py-6 text-[13px] text-slate-600">{view === "active" ? "No active campaigns. Start with New campaign." : "Nothing archived yet."}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-slate-500"><tr><th className="px-4 py-2 font-medium">Campaign</th><th className="px-2 py-2 font-medium">People found</th><th className="px-2 py-2 font-medium">Invited</th><th className="px-2 py-2 font-medium">Accepted</th><th className="px-2 py-2 font-medium">Messaged</th><th className="px-2 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
              <tbody>
                {shown.map((c) => {
                  const s = STATUS[c.status];
                  const approved = !c.needs_approval;
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                      <td className="px-2 py-2.5">{c.people}</td>
                      <td className="px-2 py-2.5">{c.invited}</td>
                      <td className="px-2 py-2.5">{c.accepted}</td>
                      <td className="px-2 py-2.5">{c.messaged}</td>
                      <td className="px-2 py-2.5"><Tag tone={s.tone}>{s.label}</Tag></td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap justify-end gap-2">
                          {!c.archived_at && !approved && c.status !== "stopped" && c.status !== "completed" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "approve")}>Approve wording</button> : null}
                          {!c.archived_at && approved && (c.status === "draft" || c.status === "pending_approval") ? <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => act(c.id, "start")}>Start</button> : null}
                          {!c.archived_at && (c.status === "ready" || c.status === "running") ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "pause")}>Pause</button> : null}
                          {!c.archived_at && c.status === "paused" ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "start")}>Resume</button> : null}
                          {c.status !== "stopped" && c.status !== "completed" && c.status !== "draft" && !c.archived_at ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "stop")}>Stop</button> : null}
                          {c.archived_at ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "restore", { text: `${c.name} restored.`, undoId: null })}>Restore</button> : null}
                          {!c.archived_at && REMOVABLE.has(c.status) ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => act(c.id, "archive", { text: `${c.name} archived.`, undoId: c.id })}>Archive</button> : null}
                          {REMOVABLE.has(c.status) ? <button type="button" className={dangerCls} disabled={busy !== null} onClick={() => setConfirmDelete(c)}>Delete</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-3">
          <ErrorLine text={error} />
          {note ? (
            <p role="status" className="text-[12.5px] text-slate-600">
              {note.text}
              {note.undoId ? <> <button type="button" className="font-medium text-[#1A6CE4] underline" disabled={busy !== null} onClick={() => act(note.undoId as string, "restore", { text: "Archive undone.", undoId: null })}>Undo</button></> : null}
            </p>
          ) : null}
        </div>
      </Section>
      {confirmDelete ? (
        <Modal title={`Delete ${confirmDelete.name}?`} onClose={() => setConfirmDelete(null)} width={460}
          footer={<>
            <button type="button" className={btnCls} onClick={() => setConfirmDelete(null)}>Cancel</button>
            {confirmDelete.archived_at ? null : <button type="button" className={btnCls} disabled={busy !== null} onClick={() => { const c = confirmDelete; setConfirmDelete(null); void act(c.id, "archive", { text: `${c.name} archived.`, undoId: c.id }); }}>Archive instead</button>}
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => void remove(confirmDelete)}>Delete permanently</button>
          </>}>
          <p className="text-[13px] text-slate-800">This permanently removes the campaign and its {confirmDelete.people} {confirmDelete.people === 1 ? "person" : "people"} found. This cannot be undone.</p>
          <p className="text-[12.5px] text-slate-500">To keep the data and hide the campaign, archive it instead.</p>
        </Modal>
      ) : null}
      {needApproval.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px]">
          <b className="text-amber-900">{needApproval.length === 1 ? "1 thing needs you" : `${needApproval.length} things need you`}</b>
          <p className="text-[12.5px] text-amber-800">Approve the wording for {needApproval.map((c) => `"${c.name}"`).join(", ")} before it can start. Nothing sends unapproved text.</p>
        </div>
      ) : null}
    </div>
  );
}
