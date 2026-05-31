"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageBuilderPreview } from "@/components/page-builder/PageBuilderPreview";
import { BLOCK_DEFINITIONS, createBlock, getBlockDefinition } from "@/lib/page-builder/blocks";
import type {
  PageBlock,
  PageBlockType,
  PageBuilderSlug,
  PageBuilderSnapshotRow,
  PageLayoutDocument,
  PreviewMode,
  ValidationWarning,
} from "@/lib/page-builder/types";
import { PAGE_BUILDER_SLUGS } from "@/lib/page-builder/types";
import { validateLayout } from "@/lib/page-builder/validation";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function updateBlockProp(blocks: PageBlock[], blockId: string, key: string, value: unknown) {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, props: { ...block.props, [key]: value } } : block,
  );
}

export function PageBuilderLab() {
  const [pageSlug, setPageSlug] = useState<PageBuilderSlug>("home");
  const [layout, setLayout] = useState<PageLayoutDocument>({ version: 1, pageSlug: "home", blocks: [] });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [snapshots, setSnapshots] = useState<PageBuilderSnapshotRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedBlock = layout.blocks.find((b) => b.id === selectedBlockId) ?? null;

  const refreshWarnings = useCallback((doc: PageLayoutDocument) => {
    setWarnings(validateLayout(doc));
  }, []);

  const loadDraft = useCallback(async (slug: PageBuilderSlug) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/page-builder/${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load draft.");
      setLayout(data.draft.layout as PageLayoutDocument);
      setWarnings(data.warnings ?? validateLayout(data.draft.layout));
      setSelectedBlockId(data.draft.layout.blocks[0]?.id ?? null);

      const snapRes = await fetch(`/api/admin/page-builder/${slug}/snapshots`);
      const snapData = await snapRes.json();
      if (snapRes.ok) setSnapshots(snapData.snapshots ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDraft(pageSlug);
  }, [loadDraft, pageSlug]);

  const saveDraft = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/page-builder/${pageSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: { ...layout, pageSlug, version: 1 } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save draft.");
      setLayout(data.draft.layout as PageLayoutDocument);
      setWarnings(data.warnings ?? []);
      setStatus("Draft saved to Supabase (lab only).");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (path: string, method = "POST") => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(path, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      if (data.draft) {
        setLayout(data.draft.layout as PageLayoutDocument);
        setWarnings(data.warnings ?? []);
      }
      if (path.includes("/snapshots") && !path.includes("/restore")) {
        const snapRes = await fetch(`/api/admin/page-builder/${pageSlug}/snapshots`);
        const snapData = await snapRes.json();
        if (snapRes.ok) setSnapshots(snapData.snapshots ?? []);
      }
      setStatus("Done.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const addBlock = (type: PageBlockType) => {
    const block = createBlock(type);
    const next = { ...layout, blocks: [...layout.blocks, block] };
    setLayout(next);
    refreshWarnings(next);
    setSelectedBlockId(block.id);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= layout.blocks.length) return;
    const blocks = [...layout.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    const next = { ...layout, blocks };
    setLayout(next);
    refreshWarnings(next);
  };

  const toggleVisibility = (blockId: string) => {
    const next = {
      ...layout,
      blocks: layout.blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b)),
    };
    setLayout(next);
    refreshWarnings(next);
  };

  const removeBlock = (blockId: string) => {
    const next = { ...layout, blocks: layout.blocks.filter((b) => b.id !== blockId) };
    setLayout(next);
    refreshWarnings(next);
    if (selectedBlockId === blockId) setSelectedBlockId(next.blocks[0]?.id ?? null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...layout, pageSlug, version: 1 }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `capitalos-page-builder-${pageSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as PageLayoutDocument;
    const next = { ...parsed, pageSlug, version: 1 as const };
    setLayout(next);
    refreshWarnings(next);
    setStatus("JSON imported locally — save draft to persist.");
  };

  const errorCount = useMemo(() => warnings.filter((w) => w.severity === "error").length, [warnings]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Page Builder Lab</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--navy)]">Sandbox layout editor</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Phase 1 drafts only. Preview at{" "}
            <Link href={`/preview/${pageSlug}`} className="font-medium text-[var(--navy)] underline">
              /preview/{pageSlug}
            </Link>
            . Production routes are not modified.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cap-btn-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={saving} onClick={() => void saveDraft()}>
            <Save className="mr-1 inline h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <Link href={`/preview/${pageSlug}`} target="_blank" className="cap-btn-secondary inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold">
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
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void runAction(`/api/admin/page-builder/${pageSlug}/demo`)}>
          <Sparkles className="mr-1 inline h-4 w-4" aria-hidden />
          Load demo
        </button>
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void runAction(`/api/admin/page-builder/${pageSlug}/reset`)}>
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
        <button type="button" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-sm" disabled={loading} onClick={() => void runAction(`/api/admin/page-builder/${pageSlug}/snapshots`)}>
          Snapshot
        </button>
        <div className="ml-auto flex gap-1 rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${previewMode === "desktop" ? "bg-[var(--navy)] text-white" : "text-slate-600"}`}
            onClick={() => setPreviewMode("desktop")}
          >
            <Monitor className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Desktop
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium ${previewMode === "mobile" ? "bg-[var(--navy)] text-white" : "text-slate-600"}`}
            onClick={() => setPreviewMode("mobile")}
          >
            <Smartphone className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Mobile
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_320px]">
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <h2 className="text-sm font-semibold text-[var(--navy)]">Approved blocks</h2>
          <div className="mt-3 space-y-2">
            {BLOCK_DEFINITIONS.map((def) => (
              <button
                key={def.type}
                type="button"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-300 hover:bg-slate-50"
                onClick={() => addBlock(def.type)}
              >
                <span className="font-medium text-[var(--navy)]">{def.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{def.description}</span>
              </button>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[var(--navy)]">Block order</h3>
          <ul className="mt-2 space-y-1">
            {layout.blocks.map((block, index) => {
              const def = getBlockDefinition(block.type);
              return (
                <li key={block.id}>
                  <div
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${
                      selectedBlockId === block.id ? "border-[var(--navy)] bg-[var(--navy-muted)]" : "border-slate-200"
                    }`}
                  >
                    <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => setSelectedBlockId(block.id)}>
                      {def?.label ?? block.type}
                      {!block.visible ? " (hidden)" : ""}
                    </button>
                    <button type="button" aria-label="Move up" className="p-1 text-slate-500" onClick={() => moveBlock(index, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Move down" className="p-1 text-slate-500" onClick={() => moveBlock(index, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Toggle visibility" className="p-1 text-slate-500" onClick={() => toggleVisibility(block.id)}>
                      {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" aria-label="Remove block" className="p-1 text-red-600" onClick={() => removeBlock(block.id)}>
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          {loading ? <p className="text-sm text-slate-500">Loading draft…</p> : null}
          <PageBuilderPreview blocks={layout.blocks} previewMode={previewMode} />
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <h2 className="text-sm font-semibold text-[var(--navy)]">Validation</h2>
            <p className="mt-1 text-xs text-slate-500">
              {errorCount > 0 ? `${errorCount} error(s)` : "No blocking errors"} · {warnings.length} total
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
              {warnings.length === 0 ? (
                <li className="text-slate-500">No warnings.</li>
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

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            <h2 className="text-sm font-semibold text-[var(--navy)]">Snapshots</h2>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
              {snapshots.length === 0 ? (
                <li className="text-slate-500">No snapshots yet.</li>
              ) : (
                snapshots.map((snapshot) => (
                  <li key={snapshot.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                    <span className="truncate">{snapshot.label ?? snapshot.created_at}</span>
                    <button
                      type="button"
                      className="shrink-0 font-semibold text-[var(--navy)]"
                      onClick={() => void runAction(`/api/admin/page-builder/${pageSlug}/snapshots/${snapshot.id}/restore`)}
                    >
                      Restore
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {selectedBlock ? (
            <BlockEditor
              block={selectedBlock}
              onChange={(key, value) => {
                const next = {
                  ...layout,
                  blocks: updateBlockProp(layout.blocks, selectedBlock.id, key, value),
                };
                setLayout(next);
                refreshWarnings(next);
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              Select a block to edit text, images, and CTAs.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
}: Readonly<{
  block: PageBlock;
  onChange: (key: string, value: unknown) => void;
}>) {
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
      <h2 className="text-sm font-semibold text-[var(--navy)]">Edit {def?.label ?? block.type}</h2>
      <div className="mt-3 space-y-3">
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
      </div>
    </div>
  );
}
