"use client";

import { useCallback, useState } from "react";
import { ViewToolbar } from "@/components/ui/ViewToolbar";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  EXPORT_TYPES,
  IMPORT_FIELD_DEFINITIONS,
  IMPORT_TYPES,
  IMPORT_TYPE_LABELS,
  type ExportFormat,
  type ExportType,
  type ImportPreviewResult,
  type ImportType,
} from "@/lib/imports/types";
import { AdminCrmExportConnector } from "@/components/admin/AdminCrmExportConnector";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OperationalStatus } from "@/lib/ui/design-tokens";

type WizardStep = "type" | "upload" | "mapping" | "validate" | "confirm" | "result";

type ImportBatchRecord = {
  id: string;
  import_type: string;
  file_name: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  created_rows: number;
  updated_rows: number;
  skipped_rows: number;
  failed_rows: number;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

type ConfirmResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

const EXPORT_LABELS: Record<ExportType, string> = {
  companies: "Companies",
  investors: "Platform investors",
  founder_contacts: "Founder investor contacts",
  spv_readiness: "SPV readiness summary",
  compliance_events: "Compliance events summary",
  outreach_campaigns: "Outreach campaigns summary",
  due_diligence: "Due diligence report data",
  investor_activity: "Investor activity summary",
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map" },
  { id: "validate", label: "Validate" },
  { id: "confirm", label: "Confirm" },
  { id: "result", label: "Result" },
];

function rowStatusBadge(status: string) {
  const map: Record<string, OperationalStatus> = {
    valid: "success",
    warning: "warning",
    error: "danger",
    completed: "success",
    validated: "info",
    failed: "danger",
    uploaded: "pending",
    canceled: "neutral",
  };
  return <StatusBadge label={status} status={map[status] ?? "neutral"} dot />;
}

export function AdminImportExportCenter({
  initialBatches,
}: Readonly<{ initialBatches: ImportBatchRecord[] }>) {
  const { viewMode, density, setViewMode, setDensity, allowedModes } = useViewMode("admin-imports");
  const [step, setStep] = useState<WizardStep>("type");
  const [importType, setImportType] = useState<ImportType>("companies");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateBehavior, setDuplicateBehavior] = useState<"skip" | "update">("skip");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [batches, setBatches] = useState(initialBatches);
  const [exportType, setExportType] = useState<ExportType>("companies");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");

  const fieldOptions = IMPORT_FIELD_DEFINITIONS[importType].map((field) => field.field);

  const refreshBatches = useCallback(async () => {
    const response = await fetch("/api/admin/imports");
    if (!response.ok) return;
    const payload = await response.json();
    setBatches(payload.batches ?? []);
  }, []);

  const runPreview = useCallback(
    async (nextMapping?: Record<string, string>) => {
      if (!file) return;
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("importType", importType);
        if (nextMapping) {
          formData.append("mapping", JSON.stringify(nextMapping));
        }
        const response = await fetch("/api/admin/imports/preview", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Preview failed");
        }
        setPreview(payload.preview);
        setBatchId(payload.batchId);
        setMapping(payload.preview.suggestedMapping ?? {});
        setStep(nextMapping ? "validate" : "mapping");
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Preview failed");
      } finally {
        setLoading(false);
      }
    },
    [file, importType],
  );

  const confirmImport = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, duplicateBehavior }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed");
      }
      setConfirmResult(payload.result);
      setStep("result");
      await refreshBatches();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }, [batchId, duplicateBehavior, refreshBatches]);

  const downloadTemplate = (type: ImportType) => {
    window.location.href = `/api/admin/imports/templates/${type}`;
  };

  const downloadExport = () => {
    window.location.href = `/api/admin/exports?type=${exportType}&format=${exportFormat}`;
  };

  const resetWizard = () => {
    setStep("type");
    setFile(null);
    setPreview(null);
    setBatchId(null);
    setMapping({});
    setConfirmResult(null);
    setError(null);
  };

  return (
    <div className="space-y-8">
      <ViewToolbar
        viewMode={viewMode}
        allowedModes={allowedModes}
        onViewModeChange={setViewMode}
        density={density}
        onDensityChange={setDensity}
        showSearch={false}
        showSavedViews={false}
        sticky
      />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Imports do not approve investors or publish companies automatically. All imports are audited
        and require admin confirmation before writing data.
      </div>

      {viewMode === "table" ? null : (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Import wizard</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((item, index) => (
            <span
              key={item.id}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                step === item.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {index + 1}. {item.label}
            </span>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {step === "type" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setImportType(type);
                  setStep("upload");
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  importType === type
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-900">{IMPORT_TYPE_LABELS[type]}</p>
                <p className="mt-1 text-xs text-slate-500">CSV or XLSX</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === "upload" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Selected: <span className="font-medium">{IMPORT_TYPE_LABELS[importType]}</span>
            </p>
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-indigo-400">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-sm font-medium text-slate-800">Drop CSV or XLSX here</p>
              <p className="mt-1 text-xs text-slate-500">{file?.name ?? "No file selected"}</p>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("type")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!file || loading}
                onClick={() => void runPreview()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Parsing…" : "Parse & detect columns"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "mapping" && preview ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">Adjust column mapping before validation.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Source column</th>
                    <th className="px-3 py-2">CapitalOS field</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.map((header) => (
                    <tr key={header} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{header}</td>
                      <td className="px-3 py-2">
                        <select
                          value={mapping[header] ?? ""}
                          onChange={(event) =>
                            setMapping((current) => ({
                              ...current,
                              [header]: event.target.value,
                            }))
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">— skip —</option>
                          {fieldOptions.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("upload")} className="rounded-lg border px-4 py-2 text-sm">
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runPreview(mapping)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Validating…" : "Validate preview"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "validate" && preview ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Valid", preview.counts.valid, "green"],
              ["Warnings", preview.counts.warning, "amber"],
              ["Errors", preview.counts.error, "red"],
              ["Duplicates", preview.counts.duplicate, "slate"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {step === "validate" && preview ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Mapped data</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 25).map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">
                      {rowStatusBadge(row.status)}
                    </td>
                    <td className="px-3 py-2 font-mono">{JSON.stringify(row.mapped)}</td>
                    <td className="px-3 py-2 text-red-700">
                      {[...row.errors, ...row.warnings].join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {step === "validate" && preview ? (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("mapping")} className="rounded-lg border px-4 py-2 text-sm">
                Back
              </button>
              <button
                type="button"
                disabled={loading || preview.counts.valid + preview.counts.warning === 0}
                onClick={() => setStep("confirm")}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Review & confirm
              </button>
            </div>
          </div>
        ) : null}

        {step === "confirm" && preview ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-700">
              Ready to import{" "}
              <strong>{preview.counts.valid + preview.counts.warning}</strong> rows from{" "}
              <strong>{preview.fileName}</strong>. Rows with errors will be skipped.
            </p>
            <label className="block text-sm text-slate-700">
              Duplicate handling
              <select
                value={duplicateBehavior}
                onChange={(event) => setDuplicateBehavior(event.target.value as "skip" | "update")}
                className="mt-1 rounded border border-slate-300 px-2 py-1"
              >
                <option value="skip">Skip existing matches</option>
                <option value="update">Update existing matches</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("validate")} className="rounded-lg border px-4 py-2 text-sm">
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmImport()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Importing…" : "Confirm import"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "result" && confirmResult ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Created", confirmResult.created],
                ["Updated", confirmResult.updated],
                ["Skipped", confirmResult.skipped],
                ["Failed", confirmResult.failed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase text-slate-500">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={resetWizard} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
              Start new import
            </button>
          </div>
        ) : null}
      </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Download templates</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IMPORT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => downloadTemplate(type)}
              className="rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-300"
            >
              <p className="font-medium text-slate-900">{IMPORT_TYPE_LABELS[type]}</p>
              <p className="mt-1 text-xs text-indigo-600">Download CSV template</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Export center</h2>
        <p className="mt-1 text-sm text-slate-600">
          Exports exclude passwords, OAuth tokens, message bodies, and private file paths.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={exportType}
            onChange={(event) => setExportType(event.target.value as ExportType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {EXPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EXPORT_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
            <option value="json">JSON</option>
          </select>
          <button
            type="button"
            onClick={downloadExport}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Download export
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Recent imports</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No imports yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{batch.file_name}</td>
                    <td className="px-3 py-2">{IMPORT_TYPE_LABELS[batch.import_type as ImportType] ?? batch.import_type}</td>
                    <td className="px-3 py-2">
                      {rowStatusBadge(batch.status)}
                    </td>
                    <td className="px-3 py-2">
                      {batch.created_rows}/{batch.updated_rows}/{batch.skipped_rows}/{batch.failed_rows}
                    </td>
                    <td className="px-3 py-2">
                      {batch.profiles?.full_name ?? batch.profiles?.email ?? "Staff"}
                    </td>
                    <td className="px-3 py-2">{new Date(batch.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AdminCrmExportConnector />

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">Import safety rules</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Admin and analyst staff only — no founder or investor upload access.</li>
          <li>Preview and validate before any write; error rows are never imported.</li>
          <li>Companies import as pending review — never auto-published.</li>
          <li>Investors import as submitted/draft — never auto-approved.</li>
          <li>Founder contacts remain private to the founder and company.</li>
          <li>Every preview, confirm, and export is written to audit logs.</li>
          <li>Import batch rows store entity IDs for future rollback support.</li>
        </ul>
      </section>
    </div>
  );
}
