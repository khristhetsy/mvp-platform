"use client";

/**
 * Imports: Uploaded → Cleaned → Verifying → Published. A new import is an Excel
 * or CSV list run through the four step wizard (ImportWizard); cleaning runs on
 * the server and the result shows here. Rows stay drafts until the import is published.
 *
 * Each row has a ⋯ menu: Rename (in place), Edit details, Archive, Delete.
 * Archived imports move to the Archived tab and can be restored.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NewButton } from "@/components/admin/ToolbarGear";
import { Section, Tag, fmtPT, postJson, type Tone } from "@/components/admin/investor-directory/ui";
import { ImportWizard } from "@/components/admin/investor-directory/ImportWizard";
import type { ImportRow } from "@/lib/investor-directory/db";

const STAGES: { key: string; label: string }[] = [
  { key: "uploaded", label: "Uploaded" },
  { key: "cleaned", label: "Cleaned" },
  { key: "verifying", label: "Verifying" },
  { key: "published", label: "Published" },
];
const STATUS_TONE: Record<string, Tone> = { cleaned: "info", verifying: "warn", published: "ok" };

type Confirm = { kind: "archive" | "delete"; imp: ImportRow } | null;

async function deleteJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Something went wrong. Try again." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again." };
  }
}

export function ImportsClient({ imports, openNew }: Readonly<{ imports: ImportRow[]; openNew: boolean }>) {
  const router = useRouter();
  const [open, setOpen] = useState(openNew);
  const [done, setDone] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editing, setEditing] = useState<ImportRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editRelabel, setEditRelabel] = useState(true);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [deleteRecords, setDeleteRecords] = useState(false);
  const [typed, setTyped] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = imports.filter((i) => !i.archived_at);
  const archived = imports.filter((i) => i.archived_at);
  const shown = tab === "active" ? active : archived;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuId(null);
      setRenamingId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function publish(id: string) {
    setPublishing(id);
    const r = await postJson<{ published: number }>(`/api/admin/investor-directory/imports/${id}`, "POST", {});
    setPublishing(null);
    setDone(r.ok ? `${r.data.published.toLocaleString("en-US")} records published to founders.` : r.error);
    router.refresh();
  }

  function startRename(i: ImportRow) {
    setMenuId(null); setActionError(null);
    setRenamingId(i.id); setRenameValue(i.name);
  }

  async function saveRename(i: ImportRow) {
    const next = renameValue.trim();
    if (!next) { setActionError("The name can't be empty."); return; }
    if (next === i.name) { setRenamingId(null); return; }
    setActionBusy(true); setActionError(null);
    const r = await postJson<{ import: ImportRow }>(`/api/admin/investor-directory/imports/${i.id}`, "PATCH", { action: "update", name: next });
    setActionBusy(false);
    if (!r.ok) { setActionError(r.error); return; }
    setRenamingId(null);
    setDone(`Renamed to "${next}".`);
    router.refresh();
  }

  function startEdit(i: ImportRow) {
    setMenuId(null); setActionError(null);
    setEditing(i); setEditName(i.name); setEditSource(i.source); setEditUrl(i.source_url ?? ""); setEditRelabel(true);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim() || !editSource.trim()) { setActionError("Add a name and a source."); return; }
    const labelChanged = editSource.trim() !== editing.source || editUrl.trim() !== (editing.source_url ?? "");
    setActionBusy(true); setActionError(null);
    const r = await postJson<{ import: ImportRow }>(`/api/admin/investor-directory/imports/${editing.id}`, "PATCH", {
      action: "update", name: editName.trim(), source: editSource.trim(), sourceUrl: editUrl.trim(), relabelRecords: labelChanged && editRelabel,
    });
    setActionBusy(false);
    if (!r.ok) { setActionError(r.error); return; }
    setEditing(null);
    setDone(`Saved "${editName.trim()}".`);
    router.refresh();
  }

  function startConfirm(kind: "archive" | "delete", imp: ImportRow) {
    setMenuId(null); setActionError(null); setDeleteRecords(false); setTyped("");
    setConfirm({ kind, imp });
  }

  async function runConfirm() {
    if (!confirm) return;
    const { kind, imp } = confirm;
    setActionBusy(true); setActionError(null);
    if (kind === "archive") {
      const r = await postJson<{ ok: true }>(`/api/admin/investor-directory/imports/${imp.id}`, "PATCH", { action: "archive" });
      setActionBusy(false);
      if (!r.ok) { setActionError(r.error); return; }
      setDone(`Archived "${imp.name}". Its records stay published.`);
    } else {
      const r = await deleteJson<{ recordsDeleted: number }>(`/api/admin/investor-directory/imports/${imp.id}`, { withRecords: deleteRecords });
      setActionBusy(false);
      if (!r.ok) { setActionError(r.error); return; }
      setDone(deleteRecords
        ? `Deleted "${imp.name}" and ${r.data.recordsDeleted.toLocaleString("en-US")} records.`
        : `Deleted "${imp.name}". Its records stay in the directory.`);
    }
    setConfirm(null);
    router.refresh();
  }

  async function restore(imp: ImportRow) {
    setActionError(null);
    const r = await postJson<{ ok: true }>(`/api/admin/investor-directory/imports/${imp.id}`, "PATCH", { action: "restore" });
    if (!r.ok) { setActionError(r.error); return; }
    setDone(`Restored "${imp.name}".`);
    router.refresh();
  }

  const menuItem = "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] text-slate-800 hover:bg-slate-100";
  const deleteReady = !deleteRecords || typed === "DELETE";

  return (
    <div className="space-y-4">
      <Section title="Imports" icon="ti-file-import" action={<NewButton label="New import" onClick={() => { setOpen(true); setDone(null); }} />}>
        <div className="flex flex-wrap items-center gap-1 px-4 py-3 text-[11px]">
          {STAGES.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              {i > 0 ? <i className="ti ti-chevron-right text-slate-400" aria-hidden="true" /> : null}
              <span className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-600">{s.label}</span>
            </span>
          ))}
          <span className="ml-2 text-slate-500">Cleaning runs on every import: dedupe by email, normalize names and phones, flag bad email formats, map labels to the platform lists, tag source and date.</span>
        </div>
        <div className="flex gap-1 px-4 pb-3" role="tablist" aria-label="Import list">
          {([["active", "Active", active.length], ["archived", "Archived", archived.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => { setTab(key); setMenuId(null); setRenamingId(null); }}
              className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold ${tab === key ? "bg-[#E6F1FB] text-[#0C447C]" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label} <span className="ml-1">{count}</span>
            </button>
          ))}
        </div>
        {done ? <p className="mx-4 mb-3 rounded-md bg-[#EAF3DE] px-3 py-2 text-[12.5px] text-[#27500A]">{done}</p> : null}
        {actionError && !editing && !confirm ? <p className="mx-4 mb-3 rounded-md bg-[#FCEBEB] px-3 py-2 text-[12.5px] text-[#791F1F]">{actionError}</p> : null}
        {shown.length === 0 ? (
          <p className="px-4 pb-8 pt-4 text-center text-sm text-slate-500">
            {tab === "archived" ? "No archived imports." : "No imports yet. Start with a public source such as the SBA SBIC directory."}
          </p>
        ) : shown.map((i) => (
          <div key={i.id} className="relative flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-[13px]">
            <div className="min-w-0 flex-1">
              {renamingId === i.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`rename-${i.id}`}>Import name</label>
                  <input
                    id={`rename-${i.id}`}
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveRename(i); }}
                    maxLength={200}
                    className="h-9 min-w-[16rem] flex-1 rounded-md border-2 border-[#1A6CE4] px-2.5 text-[13px] outline-none"
                  />
                  <button type="button" disabled={actionBusy} onClick={() => void saveRename(i)} className="h-9 rounded-lg bg-[#1A6CE4] px-3 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">Save</button>
                  <button type="button" onClick={() => setRenamingId(null)} className="h-9 rounded-lg border border-slate-300 px-3 text-[12.5px]">Cancel</button>
                  <span className="basis-full text-[11.5px] text-slate-500">Enter to save, Esc to cancel</span>
                </div>
              ) : (
                <div className="font-medium text-slate-900">{i.name}</div>
              )}
              <div className="text-[12px] text-slate-500">
                {i.source} · {i.row_count.toLocaleString("en-US")} rows · {i.created_count.toLocaleString("en-US")} new · {i.merged_count.toLocaleString("en-US")} merged · {i.invalid_email_count} bad emails · {fmtPT(i.created_at, true)}
              </div>
            </div>
            {i.archived_at ? <Tag tone="mute">Archived</Tag> : (
              <Tag tone={STATUS_TONE[i.status]}>{i.status === "verifying" ? "Verifying" : i.status === "published" ? "Published" : "Cleaned"}</Tag>
            )}
            <Link href={`/admin/investor-directory/records?importId=${i.id}`} className="text-[12.5px] text-[#1A6CE4]">Review rows</Link>
            {!i.archived_at && i.status !== "published" ? (
              <button type="button" disabled={publishing === i.id} onClick={() => void publish(i.id)} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">
                {publishing === i.id ? "Publishing…" : "Publish"}
              </button>
            ) : null}
            {i.archived_at ? (
              <button type="button" onClick={() => void restore(i)} className="h-9 rounded-lg border border-slate-300 px-3 text-[12.5px] font-semibold hover:bg-slate-50">Restore</button>
            ) : null}
            <button
              type="button"
              aria-label={`Actions for ${i.name}`}
              aria-haspopup="menu"
              aria-expanded={menuId === i.id}
              onClick={() => setMenuId(menuId === i.id ? null : i.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 ${menuId === i.id ? "bg-[#EEF2FF]" : "bg-white"}`}
            >
              <i className="ti ti-dots" aria-hidden="true" />
            </button>
            {menuId === i.id ? (
              <>
                <button type="button" aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} />
                <div role="menu" className="absolute right-4 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button type="button" role="menuitem" className={menuItem} onClick={() => startRename(i)}><i className="ti ti-pencil text-slate-500" aria-hidden="true" />Rename</button>
                  <button type="button" role="menuitem" className={menuItem} onClick={() => startEdit(i)}><i className="ti ti-adjustments-horizontal text-slate-500" aria-hidden="true" />Edit details</button>
                  {i.archived_at ? (
                    <button type="button" role="menuitem" className={menuItem} onClick={() => { setMenuId(null); void restore(i); }}><i className="ti ti-arrow-back-up text-slate-500" aria-hidden="true" />Restore</button>
                  ) : (
                    <button type="button" role="menuitem" className={menuItem} onClick={() => startConfirm("archive", i)}><i className="ti ti-archive text-slate-500" aria-hidden="true" />Archive</button>
                  )}
                  <div className="my-1.5 h-px bg-slate-200" />
                  <button type="button" role="menuitem" className={`${menuItem} !text-[#A32D2D]`} onClick={() => startConfirm("delete", i)}><i className="ti ti-trash" aria-hidden="true" />Delete</button>
                </div>
              </>
            ) : null}
          </div>
        ))}
      </Section>

      {open ? (
        <ImportWizard
          onClose={() => setOpen(false)}
          onDone={(message) => { setOpen(false); setDone(message); router.refresh(); }}
        />
      ) : null}

      {editing ? (
        <div role="dialog" aria-modal="true" aria-label="Edit import" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-slate-900">Edit import</h2>
            <label className="mt-4 block text-[12px] text-slate-600">Name
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={200} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source
              <input value={editSource} onChange={(e) => setEditSource(e.target.value)} maxLength={200} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source link
              <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://www.sba.gov/…" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 flex items-start gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={editRelabel} onChange={(e) => setEditRelabel(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>Also update the source label on the {editing.created_count.toLocaleString("en-US")} records from this import</span>
            </label>
            {actionError ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">{actionError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Cancel</button>
              <button type="button" disabled={actionBusy} onClick={() => void saveEdit()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{actionBusy ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div role="dialog" aria-modal="true" aria-label={confirm.kind === "archive" ? "Archive import" : "Delete import"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            {confirm.kind === "archive" ? (
              <>
                <h2 className="text-[15px] font-semibold text-slate-900">Archive &ldquo;{confirm.imp.name}&rdquo;?</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">It moves to the Archived tab. The {confirm.imp.created_count.toLocaleString("en-US")} records stay published and founders see no change. You can restore it at any time.</p>
              </>
            ) : (
              <>
                <h2 className="text-[15px] font-semibold text-slate-900">Delete &ldquo;{confirm.imp.name}&rdquo;?</h2>
                <label className={`mt-3 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-[13px] text-slate-600 ${deleteRecords ? "border-slate-300" : "border-[#1A6CE4]"}`}>
                  <input type="radio" name="delete-mode" checked={!deleteRecords} onChange={() => { setDeleteRecords(false); setTyped(""); }} className="mt-0.5 h-4 w-4" />
                  <span><strong className="text-slate-900">Delete the import only</strong><br />The {confirm.imp.created_count.toLocaleString("en-US")} records stay in the directory.</span>
                </label>
                <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg border-2 p-3 text-[13px] text-slate-600 ${deleteRecords ? "border-[#A32D2D] bg-[#FCEBEB]" : "border-slate-200"}`}>
                  <input type="radio" name="delete-mode" checked={deleteRecords} onChange={() => setDeleteRecords(true)} className="mt-0.5 h-4 w-4" />
                  <span><strong className="text-slate-900">Delete the import and its {confirm.imp.created_count.toLocaleString("en-US")} records</strong><br />The records are removed from the directory. This cannot be undone.</span>
                </label>
                {deleteRecords ? (
                  <label className="mt-3 block text-[12px] font-semibold text-slate-700">Type DELETE to confirm
                    <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px] font-normal" />
                  </label>
                ) : null}
              </>
            )}
            {actionError ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">{actionError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Cancel</button>
              {confirm.kind === "archive" ? (
                <button type="button" disabled={actionBusy} onClick={() => void runConfirm()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{actionBusy ? "Archiving…" : "Archive"}</button>
              ) : (
                <button type="button" disabled={actionBusy || !deleteReady} onClick={() => void runConfirm()} className="rounded-lg bg-[#A32D2D] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#8B2525] disabled:opacity-45">{actionBusy ? "Deleting…" : "Delete"}</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
