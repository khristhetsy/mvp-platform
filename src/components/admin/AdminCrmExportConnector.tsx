"use client";

import { useCallback, useState } from "react";
import { CRM_EXPORT_ENTITY_TYPES, type CrmExportEntityType, type CrmExportPreview } from "@/lib/crm-connectors/types";
import { CRM_ENTITY_LABELS } from "@/lib/crm-connectors/display";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function AdminCrmExportConnector() {
  const [entityType, setEntityType] = useState<CrmExportEntityType>("companies");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [preview, setPreview] = useState<CrmExportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm-export/preview?entityType=${encodeURIComponent(entityType)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }, [entityType]);

  const downloadUrl = `/api/admin/crm-export/download?entityType=${encodeURIComponent(entityType)}&format=${format}`;

  return (
    <div id="crm-export">
    <PageSection title="CRM Export Connector">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge label="Export only" status="success" />
        <StatusBadge label="No live HubSpot sync" status="neutral" />
      </div>
      <p className="mb-4 text-xs text-slate-600">
        Sanitized HubSpot-style field mapping → preview → download package. No API sync, no contact creation, and no
        private documents or message bodies in Phase 1.
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Entity type</span>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as CrmExportEntityType)}
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            {CRM_EXPORT_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {CRM_ENTITY_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "csv" | "json")}
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadPreview()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {busy ? "Loading…" : "Preview mapped fields"}
        </button>
        <a
          href={downloadUrl}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          Download export
        </a>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {preview ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs">
          <p className="font-medium text-slate-900">
            {CRM_ENTITY_LABELS[preview.entityType]} — {preview.rowCount} row(s) (sampled {preview.sampleRowCount})
          </p>
          <ul className="list-disc pl-4 text-amber-900">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div>
            <p className="mb-1 font-semibold text-slate-700">Mapped fields</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {preview.mappedFields.map((f) => (
                <div key={f.hubspotField} className="rounded border border-slate-100 bg-white px-2 py-1">
                  <span className="font-mono text-[10px] text-slate-500">
                    {f.sourceField} → {f.hubspotField}
                  </span>
                  <span className="ml-1 text-slate-700">{f.exported ? "✓" : "—"}</span>
                  {!f.exported && f.skippedReason ? (
                    <span className="block text-[10px] text-slate-400">{f.skippedReason}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Privacy exclusions: {preview.privacyExclusions.slice(0, 8).join(", ")}
            {preview.privacyExclusions.length > 8 ? ", …" : ""}
          </p>
        </div>
      ) : null}
    </PageSection>
    </div>
  );
}
