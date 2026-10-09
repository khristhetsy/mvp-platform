"use client";

/**
 * Records and Verification lists. Same toolbar as every admin list: New, gear,
 * Odoo search bar, pager, row checkboxes with the selection bar. The search
 * runs on the server (the directory is too large to filter in the browser), so
 * the search state is mirrored into the URL.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { NewButton, ToolbarGear, downloadCsv } from "@/components/admin/ToolbarGear";
import { SelectionBar, ActionResult } from "@/components/admin/sales/SelectionBar";
import { Tag, fmtPT, postJson, statusLabel, statusTone, verificationLabel, verificationTone } from "@/components/admin/investor-directory/ui";
import type { DirectoryRecord } from "@/lib/investor-directory/types";

const QUICK = [
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "suppressed", label: "Suppressed" },
  { key: "needs_input", label: "Needs input", sep: true },
  { key: "unverified", label: "Unverified" },
  { key: "bounced", label: "Bounced" },
  { key: "verified", label: "Verified" },
];
const STATUS_KEYS = new Set(["published", "draft", "suppressed"]);

export function DirectoryRecordsList({
  mode, rows, total, page, pageSize, sources, initial, staleBefore,
}: Readonly<{
  mode: "records" | "verification";
  rows: DirectoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  sources: string[];
  initial: { q: string; status: string; verification: string; source: string };
  /** ISO instant: verified before this counts as stale. */
  staleBefore: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const search: SearchState = useMemo(() => ({
    ...EMPTY_SEARCH,
    q: initial.q,
    quick: [initial.status, initial.verification].filter(Boolean),
    fields: (initial.source ? { source: [initial.source] } : {}) as Record<string, string[]>,
  }), [initial]);

  function go(next: SearchState, nextPage = 1) {
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    const status = next.quick.filter((k) => STATUS_KEYS.has(k)).at(-1);
    const ver = next.quick.filter((k) => !STATUS_KEYS.has(k)).at(-1);
    if (status) p.set("status", status);
    if (ver) p.set("verification", ver);
    const src = next.fields.source?.[0];
    if (src) p.set("source", src);
    if (nextPage > 1) p.set("page", String(nextPage));
    setSelected(new Set());
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`);
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(action: "publish" | "unpublish" | "suppress") {
    setBusy(true);
    const r = await postJson<{ updated: number }>("/api/admin/investor-directory/records/bulk", "POST", { ids: [...selected], action });
    setBusy(false);
    setResult(r.ok ? `${r.data.updated} record${r.data.updated === 1 ? "" : "s"} updated.` : r.error);
    if (r.ok) { setSelected(new Set()); router.refresh(); }
  }

  async function checkBounces() {
    const r = await postJson<{ marked: number }>("/api/admin/investor-directory/bounces", "POST", {});
    setResult(r.ok ? `${r.data.marked} record${r.data.marked === 1 ? "" : "s"} marked bounced from founder sends.` : r.error);
    if (r.ok) router.refresh();
  }

  const reasonOf = (r: DirectoryRecord): string => {
    if (r.verification === "bounced") return "Email bounced on a founder send";
    if (r.verification === "needs_input") return r.industries.length ? "Missing details" : "Industries missing";
    if (r.verification === "verified" && r.verified_at && r.verified_at < staleBefore) return `Last verified ${fmtPT(r.verified_at)}`;
    return "Not verified yet";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        {mode === "records" ? <NewButton label="New import" href="/admin/investor-directory/imports?new=1" /> : null}
        <ToolbarGear
          items={[
            { key: "bounces", icon: "ti-mail-x", label: "Check bounces", hint: "From founder sends", onClick: checkBounces },
            {
              key: "export", icon: "ti-download", label: "Export this page",
              onClick: () => downloadCsv("investor-directory.csv",
                ["firm", "contact", "email", "phone", "city", "state", "status", "verification", "source"],
                rows.map((r) => [r.firm, r.contact_name, r.email, r.phone, r.city, r.state, r.status, r.verification, r.source])),
            },
          ]}
        />
        <div className="min-w-[240px] flex-1">
          <OdooSearchBar
            scope={`investor-directory-${mode}`}
            state={search}
            onChange={(s) => go(s)}
            quick={mode === "records" ? QUICK : QUICK.filter((q) => !STATUS_KEYS.has(q.key))}
            fields={[{ key: "source", label: "Source", options: sources }]}
            groups={[]}
            placeholder="Search firm, contact, email, city, fund"
            applyDefault={false}
            width="100%"
          />
        </div>
        <OdooPager
          className="ml-auto"
          label={total === 0 ? "0 / 0" : `${from}-${to} / ${total.toLocaleString("en-US")}`}
          prev={{ onClick: page > 1 ? () => go(search, page - 1) : undefined, disabled: page <= 1 }}
          next={{ onClick: to < total ? () => go(search, page + 1) : undefined, disabled: to >= total }}
        />
      </div>
      <SelectionBar
        count={selected.size}
        total={rows.length}
        onSelectAll={() => setSelected(new Set(rows.map((r) => r.id)))}
        onClear={() => setSelected(new Set())}
        busy={busy}
        actions={[
          { key: "publish", icon: "ti-world-upload", label: "Publish", run: () => void bulk("publish") },
          { key: "unpublish", icon: "ti-eye-off", label: "Move to draft", run: () => void bulk("unpublish") },
          { key: "suppress", icon: "ti-ban", label: "Suppress", run: () => void bulk("suppress"), danger: true },
        ]}
      />
      <ActionResult text={result} onClose={() => setResult(null)} />
      {rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">
          {mode === "verification" ? "Nothing waiting for verification." : "No records match. Clear the search or start a new import."}
        </p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
              <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Select page" checked={selected.size === rows.length} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              <th className="px-2 py-2">Firm</th>
              <th className="px-2 py-2">Contact</th>
              <th className="hidden px-2 py-2 md:table-cell">Location</th>
              <th className="hidden px-2 py-2 lg:table-cell">{mode === "verification" ? "Why it's here" : "Source"}</th>
              <th className="px-2 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${r.firm}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="px-2 py-2">
                  <Link href={`/admin/investor-directory/records/${r.id}`} className="font-medium text-slate-900 hover:text-[#1A6CE4]">{r.firm}</Link>
                  {r.in_network ? <span className="ml-2"><Tag tone="ok">iCFO network</Tag></span> : null}
                </td>
                <td className="px-2 py-2 text-slate-700">
                  {r.contact_name ?? "—"}
                  <div className="text-[11.5px] text-slate-500">{r.email ?? "No email"}</div>
                </td>
                <td className="hidden px-2 py-2 text-slate-600 md:table-cell">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="hidden px-2 py-2 text-slate-600 lg:table-cell">{mode === "verification" ? reasonOf(r) : r.source}</td>
                <td className="px-2 py-2 text-right">
                  <span className="inline-flex gap-1">
                    {mode === "records" ? <Tag tone={statusTone[r.status]}>{statusLabel[r.status]}</Tag> : null}
                    <Tag tone={verificationTone[r.verification]}>{verificationLabel[r.verification]}</Tag>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
