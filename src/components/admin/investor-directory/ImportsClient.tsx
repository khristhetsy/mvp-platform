"use client";

/**
 * Imports: Uploaded → Cleaned → Verifying → Published. A new import is a CSV
 * plus where it came from; cleaning runs on the server and the result shows
 * here. Rows stay drafts until the import is published.
 */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewButton } from "@/components/admin/ToolbarGear";
import { Section, Tag, fmtPT, postJson, type Tone } from "@/components/admin/investor-directory/ui";
import type { ImportRow } from "@/lib/investor-directory/db";

const STAGES: { key: string; label: string }[] = [
  { key: "uploaded", label: "Uploaded" },
  { key: "cleaned", label: "Cleaned" },
  { key: "verifying", label: "Verifying" },
  { key: "published", label: "Published" },
];
const STATUS_TONE: Record<string, Tone> = { cleaned: "info", verifying: "warn", published: "ok" };

export function ImportsClient({ imports, openNew }: Readonly<{ imports: ImportRow[]; openNew: boolean }>) {
  const router = useRouter();
  const [open, setOpen] = useState(openNew);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !source.trim() || !file) { setError("Add a name, a source and a CSV file."); return; }
    if (!/\.csv$/i.test(file.name)) { setError("Upload a .csv file."); return; }
    setBusy(true); setError(null);
    const csv = await file.text();
    const r = await postJson<{ import: ImportRow; cleaned: { rowCount: number; merged: number; invalidEmails: number; skipped: number } }>(
      "/api/admin/investor-directory/imports", "POST", { name: name.trim(), source: source.trim(), sourceUrl: sourceUrl.trim(), fileName: file.name, csv },
    );
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const c = r.data.cleaned;
    setDone(`${c.rowCount.toLocaleString("en-US")} rows read · ${r.data.import.created_count.toLocaleString("en-US")} new · ${r.data.import.merged_count.toLocaleString("en-US")} merged · ${c.invalidEmails} bad emails · ${c.skipped} skipped (no firm). New rows are drafts until you publish.`);
    setOpen(false); setName(""); setSource(""); setSourceUrl(""); setFile(null);
    router.refresh();
  }

  async function publish(id: string) {
    setPublishing(id);
    const r = await postJson<{ published: number }>(`/api/admin/investor-directory/imports/${id}`, "POST", {});
    setPublishing(null);
    setDone(r.ok ? `${r.data.published.toLocaleString("en-US")} records published to founders.` : r.error);
    router.refresh();
  }

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
        {done ? <p className="mx-4 mb-3 rounded-md bg-[#EAF3DE] px-3 py-2 text-[12.5px] text-[#27500A]">{done}</p> : null}
        {imports.length === 0 ? (
          <p className="px-4 pb-8 pt-4 text-center text-sm text-slate-500">No imports yet. Start with a public source such as the SBA SBIC directory.</p>
        ) : imports.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-[13px]">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900">{i.name}</div>
              <div className="text-[12px] text-slate-500">
                {i.source} · {i.row_count.toLocaleString("en-US")} rows · {i.created_count.toLocaleString("en-US")} new · {i.merged_count.toLocaleString("en-US")} merged · {i.invalid_email_count} bad emails · {fmtPT(i.created_at, true)}
              </div>
            </div>
            <Tag tone={STATUS_TONE[i.status]}>{i.status === "verifying" ? "Verifying" : i.status === "published" ? "Published" : "Cleaned"}</Tag>
            <Link href={`/admin/investor-directory/records?importId=${i.id}`} className="text-[12.5px] text-[#1A6CE4]">Review rows</Link>
            {i.status !== "published" ? (
              <button type="button" disabled={publishing === i.id} onClick={() => void publish(i.id)} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">
                {publishing === i.id ? "Publishing…" : "Publish"}
              </button>
            ) : null}
          </div>
        ))}
      </Section>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="New import" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-slate-900">New import</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">Public sources only. Never scraped data from LinkedIn, Crunchbase or other sites whose terms forbid it.</p>
            <label className="mt-4 block text-[12px] text-slate-600">Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="SBA SBIC directory, Oct 2026" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="SBA SBIC Directory (sba.gov)" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">Source link
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://www.sba.gov/…" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] text-slate-600">CSV file
              <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-[12.5px]" />
            </label>
            <p className="mt-2 text-[11.5px] text-slate-500">Columns are matched by name: Firm, Contact, Email, Phone, City, State, Website, Strategy, Style, Industries, Investing Now, Fund Size, Average Investment.</p>
            {error ? <p className="mt-3 text-[12.5px] text-[#A32D2D]">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{busy ? "Cleaning…" : "Upload and clean"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
