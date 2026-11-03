import { createServiceRoleClient } from "@/lib/supabase/admin";

type UploadRow = {
  id: string;
  file_name: string;
  source: string;
  total_rows: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  columns: string[];
  mapping: string[];
  attention_rows: { reason: string; cells: string[] }[];
  raw_truncated: boolean;
  created_at: string;
};

const SOURCE_LABEL: Record<string, string> = {
  csv_import: "File upload",
  linkedin: "LinkedIn export",
  directory: "Picked from directory",
  matching: "From matching",
  manual: "Added by hand",
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Admin view of the investor data a founder has loaded: how many contacts came from
 * each source, and every file upload with its columns, what was left out, and the
 * rows held back. The original rows download as a CSV.
 */
export async function InvestorUploadsPanel({ companyId }: Readonly<{ companyId: string }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const [contactsRes, uploadsRes] = await Promise.all([
    admin.from("founder_investor_contacts").select("source, created_at").eq("company_id", companyId).limit(20000),
    admin
      .from("founder_import_uploads")
      .select("id, file_name, source, total_rows, imported, updated, skipped, failed, columns, mapping, attention_rows, raw_truncated, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const contacts = (contactsRes.data ?? []) as { source: string; created_at: string }[];
  const uploads = (uploadsRes.data ?? []) as UploadRow[];
  const bySource = new Map<string, number>();
  for (const c of contacts) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  const last = contacts.reduce<string | null>((m, c) => (!m || c.created_at > m ? c.created_at : m), null);

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Investor data</h2>
        <span className="text-xs text-slate-500">
          {contacts.length === 0
            ? "No investor data yet"
            : `${contacts.length.toLocaleString("en-US")} contacts, last added ${date(last!)}`}
        </span>
      </div>

      {bySource.size > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {[...bySource.entries()].map(([source, n]) => (
            <li key={source} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {SOURCE_LABEL[source] ?? source}: <b>{n.toLocaleString("en-US")}</b>
            </li>
          ))}
        </ul>
      ) : null}

      {uploads.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No file uploads logged. Uploads made before this log existed kept only the mapped fields, so the original file is not stored.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {uploads.map((u) => {
            const leftOut = u.columns.filter((_, i) => (u.mapping[i] ?? "skip") === "skip");
            return (
              <details key={u.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <summary className="cursor-pointer text-slate-800">
                  <b>{u.file_name}</b> · {date(u.created_at)} · {SOURCE_LABEL[u.source] ?? u.source} · {u.total_rows} rows ·{" "}
                  {u.imported} new, {u.updated} filled, {u.skipped} held back{u.failed ? `, ${u.failed} failed` : ""}
                </summary>
                <div className="mt-2 space-y-1.5 text-slate-600">
                  <p>
                    <b>Columns in the file:</b> {u.columns.join(", ") || "none"}
                  </p>
                  <p>
                    <b>Left out (not mapped):</b> {leftOut.length ? leftOut.join(", ") : "none"}
                  </p>
                  {u.attention_rows.length > 0 ? (
                    <div>
                      <b>Held back for review ({u.attention_rows.length}):</b>
                      <ul className="mt-1 list-disc pl-5">
                        {u.attention_rows.slice(0, 15).map((a, i) => (
                          <li key={i}>
                            {a.reason}: {a.cells.filter(Boolean).slice(0, 3).join(" | ").slice(0, 140)}
                          </li>
                        ))}
                        {u.attention_rows.length > 15 ? <li>and {u.attention_rows.length - 15} more in the download</li> : null}
                      </ul>
                    </div>
                  ) : null}
                  <a
                    href={`/api/admin/founder-imports/${u.id}/csv`}
                    className="inline-block font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Download original rows (CSV){u.raw_truncated ? ", first 2,000 rows only" : ""}
                  </a>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
