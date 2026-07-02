"use client";

import { Copy, Eye, GitCompare, History, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AutosaveStatus, PageBuilderDraftRow, PageBuilderSnapshotMeta, VersionViewMode } from "@/lib/page-builder/types";

function formatSnapshotTime(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function creatorLabel(snapshot: PageBuilderSnapshotMeta) {
  return snapshot.createdByName ?? snapshot.createdByEmail ?? "Unknown user";
}

export function AutosaveIndicator({ status, lastSavedAt }: Readonly<{ status: AutosaveStatus; lastSavedAt: string | null }>) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? lastSavedAt
          ? `Saved ${formatSnapshotTime(lastSavedAt)}`
          : "All changes saved"
        : status === "unsaved"
          ? "Unsaved changes"
          : status === "error"
            ? "Autosave failed"
            : "Ready";

  const tone =
    status === "saving"
      ? "bg-sky-50 text-sky-800 border-sky-200"
      : status === "saved"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : status === "unsaved"
          ? "bg-amber-50 text-amber-900 border-amber-200"
          : status === "error"
            ? "bg-red-50 text-red-800 border-red-200"
            : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          status === "saving" ? "animate-pulse bg-sky-500" : status === "saved" ? "bg-emerald-500" : status === "unsaved" ? "bg-amber-500" : status === "error" ? "bg-red-500" : "bg-slate-400"
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function RestoreSnapshotModal({
  snapshot,
  onConfirm,
  onCancel,
  busy,
}: Readonly<{
  snapshot: PageBuilderSnapshotMeta;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="restore-title">
        <h2 id="restore-title" className="text-lg font-semibold text-slate-950">
          Restore snapshot?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This will replace the current lab draft with{" "}
          <strong>{snapshot.label ?? formatSnapshotTime(snapshot.created_at)}</strong> ({snapshot.blockCount} blocks).
          An automatic backup snapshot of the current draft will be created first.
        </p>
        <p className="mt-2 text-xs text-slate-500">{t("production_pages_remain_unchanged_lab_draft")}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="cap-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={onConfirm}>
            {busy ? "Restoring…" : "Restore snapshot"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VersionHistorySidebar({
  draft,
  snapshots,
  viewMode,
  activeSnapshotId,
  compareSnapshotId,
  onSelectDraft,
  onPreviewSnapshot,
  onCompareSnapshot,
  onRestoreSnapshot,
  onDuplicateSnapshot,
  loading,
}: Readonly<{
  draft: PageBuilderDraftRow | null;
  snapshots: PageBuilderSnapshotMeta[];
  viewMode: VersionViewMode;
  activeSnapshotId: string | null;
  compareSnapshotId: string | null;
  onSelectDraft: () => void;
  onPreviewSnapshot: (snapshot: PageBuilderSnapshotMeta) => void;
  onCompareSnapshot: (snapshot: PageBuilderSnapshotMeta) => void;
  onRestoreSnapshot: (snapshot: PageBuilderSnapshotMeta) => void;
  onDuplicateSnapshot: (snapshot: PageBuilderSnapshotMeta) => void;
  loading?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  const draftActive = viewMode === "draft";

  return (
    <aside className="flex max-h-[calc(100vh-12rem)] flex-col rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-950" strokeWidth={1.75} aria-hidden />
          <h2 className="text-sm font-semibold text-slate-950">{t("version_history")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("lab_snapshots_for_this_page_only")}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <button
          type="button"
          onClick={onSelectDraft}
          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
            draftActive
              ? "border-[var(--blue)] bg-[var(--blue-muted)] ring-1 ring-[var(--blue)]/20"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-950">{t("active_draft")}</span>
            {draftActive ? (
              <span className="rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-semibold text-white">{t("current")}</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {draft?.layout.blocks.length ?? 0} blocks
            {draft?.updated_at ? ` · Updated ${formatSnapshotTime(draft.updated_at)}` : ""}
          </p>
        </button>

        {loading ? <p className="px-1 text-xs text-slate-500">{t("loading_snapshots")}</p> : null}

        {!loading && snapshots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
            No snapshots yet. Use Snapshot to capture a version.
          </p>
        ) : null}

        {snapshots.map((snapshot) => {
          const isPreview = viewMode === "snapshot-preview" && activeSnapshotId === snapshot.id;
          const isCompare = viewMode === "compare" && compareSnapshotId === snapshot.id;

          return (
            <article
              key={snapshot.id}
              className={`rounded-lg border px-3 py-3 ${
                isPreview || isCompare
                  ? "border-[var(--gold)] bg-[var(--gold-muted)]/40 ring-1 ring-[var(--gold)]/30"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {snapshot.label ?? "Untitled snapshot"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{formatSnapshotTime(snapshot.created_at)}</p>
                </div>
                {isPreview ? (
                  <span className="shrink-0 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Preview
                  </span>
                ) : isCompare ? (
                  <span className="shrink-0 rounded-full bg-[var(--blue)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Compare
                  </span>
                ) : null}
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600">
                <div>
                  <dt className="text-slate-400">Blocks</dt>
                  <dd className="font-medium text-slate-700">{snapshot.blockCount}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-400">Created by</dt>
                  <dd className="truncate font-medium text-slate-700">{creatorLabel(snapshot)}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => onPreviewSnapshot(snapshot)}
                >
                  <Eye className="h-3 w-3" aria-hidden />
                  Preview
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => onCompareSnapshot(snapshot)}
                >
                  <GitCompare className="h-3 w-3" aria-hidden />
                  Compare
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-950 hover:bg-slate-50"
                  onClick={() => onDuplicateSnapshot(snapshot)}
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                  onClick={() => onRestoreSnapshot(snapshot)}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Restore
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
