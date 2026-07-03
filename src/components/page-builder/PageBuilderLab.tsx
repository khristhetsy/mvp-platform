"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Monitor,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { SortableDragHandle, SortableList } from "@/components/ui/SortableList";
import { LayoutBlockRegionsEditor } from "@/components/page-builder/LayoutBlockRegionsEditor";
import { PageBuilderPreview } from "@/components/page-builder/PageBuilderPreview";
import {
  AutosaveIndicator,
  RestoreSnapshotModal,
  VersionHistorySidebar,
} from "@/components/page-builder/VersionHistorySidebar";
import { BLOCK_DEFINITIONS, createBlock, getBlockDefinition } from "@/lib/page-builder/blocks";
import { COMPLIANCE_NOTICE_STYLES, PROCESS_STEP_ICON_OPTIONS } from "@/lib/page-builder/content-rules";
import type {
  AutosaveStatus,
  PageBlock,
  PageBlockType,
  PageBuilderDraftRow,
  PageBuilderSlug,
  PageBuilderSnapshotMeta,
  PageLayoutDocument,
  PreviewMode,
  ValidationWarning,
  VersionViewMode,
} from "@/lib/page-builder/types";
import { PAGE_BUILDER_SLUGS } from "@/lib/page-builder/types";
import { reorderByIndex } from "@/lib/dnd/reorder";
import {
  findBlockById,
  isLayoutBlockType,
  normalizeLayoutBlocks,
  removeBlockById,
  updateBlockById,
} from "@/lib/page-builder/layout-blocks";
import { validateLayout } from "@/lib/page-builder/validation";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

// Group the palette so admins scan by intent (layout vs content vs data),
// not one flat list. Unknown/new types fall through to "Content".
type PaletteCategory = "layout" | "content" | "data";
const BLOCK_CATEGORY: Record<string, PaletteCategory> = {
  spacer: "layout", columns_2: "layout", columns_3: "layout", sidebar_layout: "layout",
  hero: "content", cta_band: "content", text_section: "content", image_banner: "content",
  testimonial: "content", faq: "content", process_steps: "content", team: "content",
  logo_cloud: "content", compliance_notice: "content",
  trust_badges: "data", feature_grid: "data", metrics_row: "data", metric: "data",
  metric_grid: "data", pricing_plan: "data", stats_comparison: "data",
};
const CATEGORY_ORDER: PaletteCategory[] = ["layout", "content", "data"];
const CATEGORY_META: Record<PaletteCategory, { labelKey: string; Icon: typeof LayoutGrid; color: string }> = {
  layout: { labelKey: "pb_cat_layout", Icon: LayoutGrid, color: "#2E78F5" },
  content: { labelKey: "pb_cat_content", Icon: Type, color: "#0F6E56" },
  data: { labelKey: "pb_cat_data", Icon: BarChart3, color: "#993556" },
};
function blockCategory(type: string): PaletteCategory {
  return BLOCK_CATEGORY[type] ?? "content";
}

function updateBlockProp(blocks: PageBlock[], blockId: string, key: string, value: unknown) {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, props: { ...block.props, [key]: value } } : block,
  );
}

function layoutFingerprint(doc: PageLayoutDocument) {
  return JSON.stringify(doc);
}

export function PageBuilderLab() {
  const t = useTranslations("sharedCmp");
  const [pageSlug, setPageSlug] = useState<PageBuilderSlug>("home");
  const [layout, setLayout] = useState<PageLayoutDocument>({ version: 1, pageSlug: "home", blocks: [] });
  const [draftMeta, setDraftMeta] = useState<PageBuilderDraftRow | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [snapshots, setSnapshots] = useState<PageBuilderSnapshotMeta[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<VersionViewMode>("draft");
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PageBuilderSnapshotMeta | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");

  const skipAutosaveRef = useRef(true);
  const savedFingerprintRef = useRef("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedBlock = useMemo(
    () => (selectedBlockId ? findBlockById(layout.blocks, selectedBlockId) : null),
    [layout.blocks, selectedBlockId],
  );

  const activeSnapshot = useMemo(
    () => snapshots.find((s) => s.id === activeSnapshotId) ?? null,
    [snapshots, activeSnapshotId],
  );
  const compareSnapshot = useMemo(
    () => snapshots.find((s) => s.id === compareSnapshotId) ?? null,
    [snapshots, compareSnapshotId],
  );

  const refreshWarnings = useCallback((doc: PageLayoutDocument) => {
    setWarnings(validateLayout(doc));
  }, []);

  const applyDraft = useCallback(
    (draft: PageBuilderDraftRow, nextWarnings?: ValidationWarning[]) => {
      skipAutosaveRef.current = true;
      setDraftMeta(draft);
      setLayout(draft.layout);
      setLastSavedAt(draft.updated_at);
      savedFingerprintRef.current = layoutFingerprint(draft.layout);
      setWarnings(nextWarnings ?? validateLayout(draft.layout));
      setAutosaveStatus("saved");
      setViewMode("draft");
      setActiveSnapshotId(null);
      setCompareSnapshotId(null);
      setSelectedBlockId(draft.layout.blocks[0]?.id ?? null);
      window.setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
    },
    [],
  );

  const refreshSnapshots = useCallback(async (slug: PageBuilderSlug) => {
    const snapRes = await fetch(`/api/admin/page-builder/${slug}/snapshots`);
    const snapData = await snapRes.json();
    if (snapRes.ok) {
      setSnapshots(snapData.snapshots ?? []);
      if (snapData.draft) setDraftMeta(snapData.draft);
    }
  }, []);

  const loadDraft = useCallback(
    async (slug: PageBuilderSlug) => {
      setLoading(true);
      setStatus(null);
      try {
        const res = await fetch(`/api/admin/page-builder/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load draft.");
        applyDraft(data.draft as PageBuilderDraftRow, data.warnings);
        await refreshSnapshots(slug);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Load failed.");
      } finally {
        setLoading(false);
      }
    },
    [applyDraft, refreshSnapshots],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load page builder draft when slug changes */
    void loadDraft(pageSlug);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadDraft, pageSlug]);

  const persistDraft = useCallback(
    async (doc: PageLayoutDocument, { manual = false }: { manual?: boolean } = {}) => {
      const docWarnings = validateLayout(doc);
      if (docWarnings.some((w) => w.severity === "error")) {
        setAutosaveStatus("unsaved");
        if (manual) setStatus("Fix validation errors before saving.");
        return false;
      }

      if (manual) setSaving(true);
      else setAutosaveStatus("saving");

      try {
        const res = await fetch(`/api/admin/page-builder/${pageSlug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: { ...doc, pageSlug, version: 1 } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save draft.");
        const draft = data.draft as PageBuilderDraftRow;
        setDraftMeta(draft);
        setLastSavedAt(draft.updated_at);
        savedFingerprintRef.current = layoutFingerprint(draft.layout);
        setWarnings(data.warnings ?? []);
        setAutosaveStatus("saved");
        if (manual) setStatus("Draft saved to Supabase (lab only).");
        return true;
      } catch (error) {
        setAutosaveStatus("error");
        if (manual) setStatus(error instanceof Error ? error.message : "Save failed.");
        return false;
      } finally {
        if (manual) setSaving(false);
      }
    },
    [pageSlug],
  );

  useEffect(() => {
    if (skipAutosaveRef.current) return;

    const fingerprint = layoutFingerprint({ ...layout, pageSlug, version: 1 });
    if (fingerprint === savedFingerprintRef.current) {
      setAutosaveStatus("saved");
      return;
    }

    setAutosaveStatus("unsaved");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void persistDraft(layout);
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [layout, pageSlug, persistDraft]);

  const saveDraft = () => void persistDraft(layout, { manual: true });

  const createSnapshot = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await persistDraft(layout);
      const res = await fetch(`/api/admin/page-builder/${pageSlug}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create snapshot.");
      await refreshSnapshots(pageSlug);
      setStatus("Snapshot saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot failed.");
    } finally {
      setLoading(false);
    }
  };

  const runDraftAction = async (path: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      if (data.draft) applyDraft(data.draft, data.warnings);
      if (data.snapshots) setSnapshots(data.snapshots);
      else await refreshSnapshots(pageSlug);
      setStatus("Done.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/admin/page-builder/${pageSlug}/snapshots/${restoreTarget.id}/restore`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed.");
      applyDraft(data.draft, data.warnings);
      if (data.snapshots) setSnapshots(data.snapshots);
      setStatus("Snapshot restored to active draft.");
      setRestoreTarget(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  const duplicateSnapshot = async (snapshot: PageBuilderSnapshotMeta) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/admin/page-builder/${pageSlug}/snapshots/${snapshot.id}/duplicate`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Duplicate failed.");
      applyDraft(data.draft, data.warnings);
      if (data.snapshots) setSnapshots(data.snapshots);
      setStatus("Snapshot duplicated into active draft.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Duplicate failed.");
    } finally {
      setLoading(false);
    }
  };

  const updateLayout = (next: PageLayoutDocument) => {
    setLayout(next);
    refreshWarnings(next);
    setViewMode("draft");
    setActiveSnapshotId(null);
    setCompareSnapshotId(null);
  };

  const addBlock = (type: PageBlockType) => {
    const block = createBlock(type);
    updateLayout({ ...layout, blocks: [...layout.blocks, block] });
    setSelectedBlockId(block.id);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= layout.blocks.length) return;
    reorderBlocks(index, target);
  };

  const reorderBlocks = (fromIndex: number, toIndex: number) => {
    updateLayout({ ...layout, blocks: reorderByIndex(layout.blocks, fromIndex, toIndex) });
  };

  const toggleVisibility = (blockId: string) => {
    updateLayout({
      ...layout,
      blocks: layout.blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b)),
    });
  };

  const removeBlock = (blockId: string) => {
    const next = { ...layout, blocks: removeBlockById(layout.blocks, blockId) };
    updateLayout(next);
    if (selectedBlockId === blockId) setSelectedBlockId(next.blocks[0]?.id ?? null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...layout, pageSlug, version: 1 }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `icapos-page-builder-${pageSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as PageLayoutDocument;
    updateLayout({ ...parsed, pageSlug, version: 1, blocks: normalizeLayoutBlocks(parsed.blocks) });
    setStatus("JSON imported locally — autosave will persist shortly.");
  };

  const errorCount = useMemo(() => warnings.filter((w) => w.severity === "error").length, [warnings]);

  return (
    <div className="space-y-4">
      {restoreTarget ? (
        <RestoreSnapshotModal
          snapshot={restoreTarget}
          busy={restoring}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={() => void confirmRestore()}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("page_builder_lab")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {t("sandbox_layout_editor")}
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              <ShieldCheck className="h-3 w-3" aria-hidden /> {t("pb_sandbox")}
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Phase 1 drafts only. Preview at{" "}
            <Link href={`/preview/${pageSlug}`} className="font-medium text-slate-950 underline">
              /preview/{pageSlug}
            </Link>
            . Production routes are not modified.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutosaveIndicator status={autosaveStatus} lastSavedAt={lastSavedAt} />
          <button
            type="button"
            className="cap-btn-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={saving}
            onClick={saveDraft}
          >
            <Save className="mr-1 inline h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <Link
            href={`/preview/${pageSlug}`}
            target="_blank"
            className="cap-btn-secondary inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <Eye className="mr-1 h-4 w-4" aria-hidden />
            Open preview
          </Link>
        </div>
      </div>

      {status ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{status}</p> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
        <label className="text-sm font-medium text-slate-700">
          Page
          <select
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            value={pageSlug}
            onChange={(e) => setPageSlug(e.target.value as PageBuilderSlug)}
          >
            {PAGE_BUILDER_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void runDraftAction(`/api/admin/page-builder/${pageSlug}/demo`)}>
          <Sparkles className="mr-1 inline h-4 w-4" aria-hidden />
          Load demo
        </button>
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void runDraftAction(`/api/admin/page-builder/${pageSlug}/reset`)}>
          <RotateCcw className="mr-1 inline h-4 w-4" aria-hidden />
          Reset
        </button>
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" onClick={exportJson}>
          <Download className="mr-1 inline h-4 w-4" aria-hidden />
          Export JSON
        </button>
        <label className="cap-btn-secondary cursor-pointer rounded-lg px-3 py-1.5 text-sm">
          <Upload className="mr-1 inline h-4 w-4" aria-hidden />
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void createSnapshot()}>
          Snapshot
        </button>
        <div className="ml-auto flex gap-1 rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${previewMode === "desktop" ? "bg-[var(--blue)] text-white" : "text-slate-600"}`}
            onClick={() => setPreviewMode("desktop")}
          >
            <Monitor className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Desktop
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${previewMode === "mobile" ? "bg-[var(--blue)] text-white" : "text-slate-600"}`}
            onClick={() => setPreviewMode("mobile")}
          >
            <Smartphone className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Mobile
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px_300px]">
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <h2 className="text-sm font-semibold text-slate-950">{t("approved_blocks")}</h2>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden />
            <input
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder={t("pb_search_blocks")}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs"
            />
          </div>
          <div className="mt-3 space-y-3">
            {CATEGORY_ORDER.map((cat) => {
              const q = paletteSearch.trim().toLowerCase();
              const defs = BLOCK_DEFINITIONS.filter(
                (d) =>
                  blockCategory(d.type) === cat &&
                  (q === "" ||
                    d.label.toLowerCase().includes(q) ||
                    (d.description ?? "").toLowerCase().includes(q)),
              );
              if (defs.length === 0) return null;
              const meta = CATEGORY_META[cat];
              return (
                <div key={cat}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    <meta.Icon className="h-3 w-3" style={{ color: meta.color }} aria-hidden />
                    {t(meta.labelKey)}
                  </p>
                  <div className="space-y-1.5">
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left text-sm hover:border-[var(--blue)] hover:bg-[var(--blue-muted)]"
                        onClick={() => addBlock(def.type)}
                      >
                        <meta.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-950">{def.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{def.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {BLOCK_DEFINITIONS.every(
              (d) =>
                paletteSearch.trim() !== "" &&
                !d.label.toLowerCase().includes(paletteSearch.trim().toLowerCase()) &&
                !(d.description ?? "").toLowerCase().includes(paletteSearch.trim().toLowerCase()),
            ) && <p className="text-xs text-slate-400">{t("pb_no_blocks_match")}</p>}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-slate-950">{t("block_order")}</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">{t("drag_the_handle_or_use_move_up_down")}</p>
          <SortableList
            items={layout.blocks}
            disabled={loading}
            listClassName="mt-2 max-h-64 space-y-1 overflow-y-auto"
            ariaLabel="Page builder block order"
            onReorder={(blocks) => updateLayout({ ...layout, blocks })}
            renderItem={(block, index, { handleProps, isDragging }) => {
              const def = getBlockDefinition(block.type);
              return (
                <div
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${
                    selectedBlockId === block.id ? "border-[var(--blue)] bg-[var(--blue-muted)]" : "border-slate-200 bg-white"
                  } ${isDragging ? "border-[var(--gold)] bg-[var(--gold-muted)]/30 shadow-sm" : ""}`}
                >
                  <SortableDragHandle
                    label={`Drag to reorder ${def?.label ?? block.type}`}
                    disabled={loading}
                    handleProps={handleProps}
                  />
                  <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => setSelectedBlockId(block.id)}>
                    {def?.label ?? block.type}
                    {!block.visible ? " (hidden)" : ""}
                  </button>
                  <button type="button" aria-label="Move up" className="p-1 text-slate-500 hover:text-slate-950" onClick={() => moveBlock(index, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Move down" className="p-1 text-slate-500 hover:text-slate-950" onClick={() => moveBlock(index, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Toggle visibility" className="p-1 text-slate-500 hover:text-slate-950" onClick={() => toggleVisibility(block.id)}>
                    {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" aria-label="Remove block" className="p-1 text-red-600 hover:text-red-700" onClick={() => removeBlock(block.id)}>
                    ×
                  </button>
                </div>
              );
            }}
            renderOverlay={(block) => {
              const def = getBlockDefinition(block.type);
              return (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--gold)] bg-white px-3 py-2 text-xs font-medium text-slate-950 shadow-lg">
                  <GripVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {def?.label ?? block.type}
                </div>
              );
            }}
          />
        </section>

        <section className="min-w-0 space-y-3">
          {loading ? <p className="text-sm text-slate-500">{t("loading_draft")}</p> : null}

          {viewMode === "compare" && compareSnapshot ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-950">{t("current_draft")}</p>
                <PageBuilderPreview blocks={layout.blocks} previewMode={previewMode} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">
                  Snapshot · {compareSnapshot.label ?? compareSnapshot.created_at}
                </p>
                <PageBuilderPreview blocks={compareSnapshot.layout.blocks} previewMode={previewMode} />
              </div>
            </div>
          ) : viewMode === "snapshot-preview" && activeSnapshot ? (
            <>
              <div className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-muted)]/30 px-3 py-2 text-xs text-slate-950">
                Previewing snapshot: <strong>{activeSnapshot.label ?? activeSnapshot.created_at}</strong> — edits apply to the active draft when you return.
              </div>
              <PageBuilderPreview blocks={activeSnapshot.layout.blocks} previewMode={previewMode} />
            </>
          ) : (
            <PageBuilderPreview blocks={layout.blocks} previewMode={previewMode} />
          )}
        </section>

        <VersionHistorySidebar
          draft={draftMeta}
          snapshots={snapshots}
          viewMode={viewMode}
          activeSnapshotId={activeSnapshotId}
          compareSnapshotId={compareSnapshotId}
          loading={loading}
          onSelectDraft={() => {
            setViewMode("draft");
            setActiveSnapshotId(null);
            setCompareSnapshotId(null);
          }}
          onPreviewSnapshot={(snapshot) => {
            setViewMode("snapshot-preview");
            setActiveSnapshotId(snapshot.id);
            setCompareSnapshotId(null);
          }}
          onCompareSnapshot={(snapshot) => {
            setViewMode("compare");
            setCompareSnapshotId(snapshot.id);
            setActiveSnapshotId(null);
          }}
          onRestoreSnapshot={setRestoreTarget}
          onDuplicateSnapshot={(snapshot) => void duplicateSnapshot(snapshot)}
        />

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <h2 className="text-sm font-semibold text-slate-950">{t("validation")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {errorCount > 0 ? `${errorCount} error(s)` : "No blocking errors"} · {warnings.length} total
            </p>
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs">
              {warnings.length === 0 ? (
                <li className="text-slate-500">{t("no_warnings")}</li>
              ) : (
                warnings.map((warning) => (
                  <li
                    key={`${warning.code}-${warning.blockId ?? "global"}`}
                    className={warning.severity === "error" ? "text-red-700" : "text-amber-800"}
                  >
                    {warning.message}
                  </li>
                ))
              )}
            </ul>
          </div>

          {selectedBlock ? (
            <BlockEditor
              block={selectedBlock}
              selectedBlockId={selectedBlockId}
              disabled={loading}
              onSelectBlock={setSelectedBlockId}
              onChange={(key, value) => {
                updateLayout({
                  ...layout,
                  blocks: updateBlockById(layout.blocks, selectedBlock.id, (b) => ({
                    ...b,
                    props: { ...b.props, [key]: value },
                  })),
                });
              }}
              onLayoutChange={(updated) => {
                updateLayout({
                  ...layout,
                  blocks: updateBlockById(layout.blocks, updated.id, () => updated),
                });
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              Select a block to edit text, images, and CTAs.
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--teal)]" aria-hidden />
        {t("pb_sandbox_footer")}
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onLayoutChange,
  onSelectBlock,
  selectedBlockId,
  disabled,
}: Readonly<{
  block: PageBlock;
  onChange: (key: string, value: unknown) => void;
  onLayoutChange?: (block: PageBlock) => void;
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string | null;
  disabled?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  const def = getBlockDefinition(block.type);

  const field = (label: string, key: string, multiline = false) => {
    const value = asString(block.props[key]);
    return (
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        {label}
        {multiline ? (
          <textarea
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
            rows={3}
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
          />
        ) : (
          <input
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
          />
        )}
      </label>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <h2 className="text-sm font-semibold text-slate-950">Edit {def?.label ?? block.type}</h2>
      <div className="mt-3 space-y-3">
        {isLayoutBlockType(block.type) && onLayoutChange && onSelectBlock ? (
          <>
            {field("Section title (optional)", "title")}
            <LayoutBlockRegionsEditor
              layoutBlock={block}
              selectedBlockId={selectedBlockId ?? null}
              disabled={disabled}
              onChange={onLayoutChange}
              onSelectBlock={onSelectBlock}
            />
          </>
        ) : null}
        {block.type === "metric" && (
          <>
            {field("Label", "label")}
            {field("Value", "value")}
            {field("Description", "description", true)}
          </>
        )}
        {block.type === "hero" && (
          <>
            {field("Eyebrow", "eyebrow")}
            {field("Headline", "headline")}
            {field("Subheadline", "subheadline", true)}
            {field("Primary CTA label", "primaryCtaLabel")}
            {field("Primary CTA href", "primaryCtaHref")}
            {field("Secondary CTA label", "secondaryCtaLabel")}
            {field("Secondary CTA href", "secondaryCtaHref")}
          </>
        )}
        {block.type === "cta_band" && (
          <>
            {field("Title", "title")}
            {field("Body", "body", true)}
            {field("CTA label", "ctaLabel")}
            {field("CTA href", "ctaHref")}
          </>
        )}
        {block.type === "text_section" && (
          <>
            {field("Eyebrow", "eyebrow")}
            {field("Title", "title")}
            {field("Body", "body", true)}
          </>
        )}
        {block.type === "image_banner" && (
          <>
            {field("Image URL", "imageUrl")}
            {field("Alt text", "alt")}
            {field("Caption", "caption")}
          </>
        )}
        {block.type === "trust_badges" && (
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Badges (comma-separated)
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
              value={Array.isArray(block.props.badges) ? block.props.badges.join(", ") : ""}
              onChange={(e) =>
                onChange(
                  "badges",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        )}
        {block.type === "feature_grid" && field("Section title", "title")}
        {block.type === "spacer" && (
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Size
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={asString(block.props.size) || "md"}
              onChange={(e) => onChange("size", e.target.value)}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
        )}
        {block.type === "testimonial" && (
          <>
            {field("Quote", "quote", true)}
            {field("Name", "name")}
            {field("Title / company", "title")}
            {field("Avatar URL (optional)", "avatarUrl")}
            {field("Avatar alt text", "avatarAlt")}
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Rating (0–5, optional)
              <input
                type="number"
                min={0}
                max={5}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
                value={block.props.rating === "" || block.props.rating === undefined ? "" : String(block.props.rating)}
                onChange={(e) => onChange("rating", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
          </>
        )}
        {block.type === "faq" && (
          <FaqItemsEditor
            title={asString(block.props.title)}
            items={
              Array.isArray(block.props.items)
                ? (block.props.items as Array<{ question: string; answer: string }>)
                : []
            }
            onTitleChange={(value) => onChange("title", value)}
            onItemsChange={(items) => onChange("items", items)}
          />
        )}
        {block.type === "process_steps" && (
          <ProcessStepsEditor
            title={asString(block.props.title)}
            subtitle={asString(block.props.subtitle)}
            steps={
              Array.isArray(block.props.steps)
                ? (block.props.steps as Array<{ icon: string; title: string; description: string }>)
                : []
            }
            onTitleChange={(value) => onChange("title", value)}
            onSubtitleChange={(value) => onChange("subtitle", value)}
            onStepsChange={(steps) => onChange("steps", steps)}
          />
        )}
        {block.type === "pricing_plan" && (
          <>
            {field("Plan name", "planName")}
            {field("Price label", "priceLabel")}
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Features (one per line)
              <textarea
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
                rows={4}
                value={Array.isArray(block.props.features) ? block.props.features.join("\n") : ""}
                onChange={(e) =>
                  onChange(
                    "features",
                    e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            {field("CTA label", "ctaLabel")}
            {field("CTA URL", "ctaHref")}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(block.props.highlighted)}
                onChange={(e) => onChange("highlighted", e.target.checked)}
              />
              Highlight plan
            </label>
          </>
        )}
        {block.type === "compliance_notice" && (
          <>
            {field("Title", "title")}
            {field("Body", "body", true)}
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Disclaimer style
              <select
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={asString(block.props.style) || "info"}
                onChange={(e) => onChange("style", e.target.value)}
              >
                {COMPLIANCE_NOTICE_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(block.props.required)}
                onChange={(e) => onChange("required", e.target.checked)}
              />
              Required for investor/deals pages
            </label>
          </>
        )}
        {block.type === "team" && (
          <>
            {field("Name", "name")}
            {field("Title", "title")}
            {field("Bio", "bio", true)}
            {field("Image URL", "imageUrl")}
            {field("Image alt text", "imageAlt")}
            {field("LinkedIn URL (optional)", "linkedInUrl")}
          </>
        )}
        {block.type === "logo_cloud" && (
          <LogoCloudEditor
            title={asString(block.props.title)}
            logos={
              Array.isArray(block.props.logos)
                ? (block.props.logos as Array<{ imageUrl: string; alt: string }>)
                : []
            }
            onTitleChange={(value) => onChange("title", value)}
            onLogosChange={(logos) => onChange("logos", logos)}
          />
        )}
        {block.type === "stats_comparison" && (
          <StatsComparisonEditor
            title={asString(block.props.title)}
            items={
              Array.isArray(block.props.items)
                ? (block.props.items as Array<{
                    category: string;
                    label: string;
                    value: string;
                    description: string;
                  }>)
                : []
            }
            onTitleChange={(value) => onChange("title", value)}
            onItemsChange={(items) => onChange("items", items)}
          />
        )}
      </div>
    </div>
  );
}

function FaqItemsEditor({
  title,
  items,
  onTitleChange,
  onItemsChange,
}: Readonly<{
  title: string;
  items: Array<{ question: string; answer: string }>;
  onTitleChange: (value: string) => void;
  onItemsChange: (items: Array<{ question: string; answer: string }>) => void;
}>) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Section title
        <input
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Question
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
              value={item.question}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], question: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Answer
            <textarea
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal"
              rows={2}
              value={item.answer}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], answer: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-red-700"
            onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
          >
            Remove FAQ
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cap-btn-secondary rounded-lg px-2 py-1 text-xs font-semibold"
        onClick={() => onItemsChange([...items, { question: "", answer: "" }])}
      >
        Add FAQ item
      </button>
    </div>
  );
}

function ProcessStepsEditor({
  title,
  subtitle,
  steps,
  onTitleChange,
  onSubtitleChange,
  onStepsChange,
}: Readonly<{
  title: string;
  subtitle: string;
  steps: Array<{ icon: string; title: string; description: string }>;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onStepsChange: (steps: Array<{ icon: string; title: string; description: string }>) => void;
}>) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Title
        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Subtitle
        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={subtitle} onChange={(e) => onSubtitleChange(e.target.value)} />
      </label>
      {steps.map((step, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Icon
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={step.icon || "check"}
              onChange={(e) => {
                const next = [...steps];
                next[index] = { ...next[index], icon: e.target.value };
                onStepsChange(next);
              }}
            >
              {PROCESS_STEP_ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Step title
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={step.title}
              onChange={(e) => {
                const next = [...steps];
                next[index] = { ...next[index], title: e.target.value };
                onStepsChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Description
            <textarea
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              rows={2}
              value={step.description}
              onChange={(e) => {
                const next = [...steps];
                next[index] = { ...next[index], description: e.target.value };
                onStepsChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-red-700 disabled:opacity-40"
            disabled={steps.length <= 3}
            onClick={() => onStepsChange(steps.filter((_, i) => i !== index))}
          >
            Remove step
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cap-btn-secondary rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-40"
        disabled={steps.length >= 6}
        onClick={() => onStepsChange([...steps, { icon: "check", title: "", description: "" }])}
      >
        Add step
      </button>
    </div>
  );
}

function LogoCloudEditor({
  title,
  logos,
  onTitleChange,
  onLogosChange,
}: Readonly<{
  title: string;
  logos: Array<{ imageUrl: string; alt: string }>;
  onTitleChange: (value: string) => void;
  onLogosChange: (logos: Array<{ imageUrl: string; alt: string }>) => void;
}>) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Section title
        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </label>
      {logos.map((logo, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Image URL
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={logo.imageUrl}
              onChange={(e) => {
                const next = [...logos];
                next[index] = { ...next[index], imageUrl: e.target.value };
                onLogosChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Alt text (required)
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={logo.alt}
              onChange={(e) => {
                const next = [...logos];
                next[index] = { ...next[index], alt: e.target.value };
                onLogosChange(next);
              }}
            />
          </label>
          <button type="button" className="mt-2 text-xs font-medium text-red-700" onClick={() => onLogosChange(logos.filter((_, i) => i !== index))}>
            Remove logo
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cap-btn-secondary rounded-lg px-2 py-1 text-xs font-semibold"
        onClick={() => onLogosChange([...logos, { imageUrl: "", alt: "" }])}
      >
        Add logo
      </button>
    </div>
  );
}

function StatsComparisonEditor({
  title,
  items,
  onTitleChange,
  onItemsChange,
}: Readonly<{
  title: string;
  items: Array<{ category: string; label: string; value: string; description: string }>;
  onTitleChange: (value: string) => void;
  onItemsChange: (items: Array<{ category: string; label: string; value: string; description: string }>) => void;
}>) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Title
        <input className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </label>
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Category (before/after)
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={item.category}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], category: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Metric label
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={item.label}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], label: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Value
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={item.value}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], value: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <label className="mt-2 grid gap-1 text-xs font-medium text-slate-700">
            Description
            <textarea
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              rows={2}
              value={item.description}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], description: e.target.value };
                onItemsChange(next);
              }}
            />
          </label>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-red-700 disabled:opacity-40"
            disabled={items.length <= 2}
            onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
          >
            Remove metric
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cap-btn-secondary rounded-lg px-2 py-1 text-xs font-semibold"
        onClick={() => onItemsChange([...items, { category: "", label: "", value: "", description: "" }])}
      >
        Add metric
      </button>
    </div>
  );
}
