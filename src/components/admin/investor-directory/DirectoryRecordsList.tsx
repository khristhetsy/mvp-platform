"use client";

/**
 * Records and Verification lists. Same toolbar as every admin list: New, gear,
 * Odoo search bar, pager, row checkboxes with the selection bar. The search
 * runs on the server (the directory is too large to filter in the browser), so
 * the search state is mirrored into the URL.
 */
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { NewButton, ToolbarGear, downloadCsv } from "@/components/admin/ToolbarGear";
import { SelectionBar, ActionResult } from "@/components/admin/sales/SelectionBar";
import { OptionPicker, Tag, fmtPT, postJson, statusLabel, statusTone, verificationLabel, verificationTone } from "@/components/admin/investor-directory/ui";
import { industryLabel } from "@/lib/investor-directory/industries";
import { FILL_FIELD_LABEL, missingFields, suggestFill, type Fill, type FillField } from "@/lib/investor-directory/fill";
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
  initial: { q: string; status: string; verification: string; source: string; importId?: string };
  /** ISO instant: verified before this counts as stale. */
  staleBefore: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [fills, setFills] = useState<Record<string, Fill>>({});
  const [siteText, setSiteText] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ website: string; investor_types: string[]; capital_types: string[]; industries: string[] }>({ website: "", investor_types: [], capital_types: [], industries: [] });
  const [keep, setKeep] = useState<Record<FillField, boolean>>({ website: false, investor_types: false, capital_types: false, industries: false });
  const [siteNote, setSiteNote] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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
    if (initial.importId) p.set("importId", initial.importId);
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

  const needsFill = rows.filter((r) => missingFields(r).length > 0);
  const FIELDS: FillField[] = ["industries", "investor_types", "capital_types", "website"];
  const SOURCE_LABEL: Record<string, string> = { name: "Firm name", domain: "Website domain", email: "Email domain", profile: "Profile text", website: "Website text", type: "Investor type" };
  const valueLabel = (f: FillField, v: string) => (f === "industries" ? industryLabel(v) : f === "website" ? v : v.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
  const guess = (r: DirectoryRecord, text?: string): Fill => suggestFill({
    firm: r.firm, website: r.website, email: r.email, profile: [r.strategy, r.notes, r.fund_name].filter(Boolean).join(" "), siteText: text,
    have: { investor_types: r.investor_types, capital_types: r.capital_types, industries: r.industries },
  });
  const rowLevel = (f: Fill | undefined): "strong" | "possible" | "none" => {
    const g = f ? Object.values(f) : [];
    return g.length === 0 ? "none" : g.every((x) => x.level === "strong") ? "strong" : "possible";
  };
  const patchOf = (f: Fill) => Object.fromEntries(FIELDS.flatMap((k) => { const g = f[k]; return g ? [[k, k === "website" ? g.values[0] : g.values]] : []; }));
  const strongIds = needsFill.filter((r) => rowLevel(fills[r.id]) === "strong").map((r) => r.id);

  function fillAll() {
    const next: Record<string, Fill> = {};
    for (const r of needsFill) next[r.id] = guess(r, siteText[r.id]);
    setFills(next);
    const lv = needsFill.map((r) => rowLevel(next[r.id]));
    setResult(`Guessed for ${needsFill.length} ${needsFill.length === 1 ? "record" : "records"}: ${lv.filter((x) => x === "strong").length} strong, ${lv.filter((x) => x === "possible").length} possible, ${lv.filter((x) => x === "none").length} no guess. Nothing is saved until you accept.`);
  }

  async function savePatch(id: string, patch: Record<string, unknown>, verify = false): Promise<boolean> {
    const r = await postJson<{ record: DirectoryRecord }>(`/api/admin/investor-directory/records/${id}`, "PATCH", { action: verify ? "verify" : "save", patch });
    if (!r.ok) { setResult(r.error); return false; }
    return true;
  }

  async function accept(id: string) {
    const f = fills[id];
    if (!f || rowLevel(f) === "none") return;
    setBusy(true);
    const ok = await savePatch(id, patchOf(f));
    setBusy(false);
    if (ok) { setResult("Saved. The record stays unverified until you check its website and verify it."); router.refresh(); }
  }

  async function acceptStrong() {
    if (!strongIds.length) return;
    setBusy(true);
    let done = 0;
    for (const id of strongIds) if (await savePatch(id, patchOf(fills[id]))) done++;
    setBusy(false);
    setResult(`${done} of ${strongIds.length} strong guesses saved. They stay unverified until you check each website.`);
    router.refresh();
  }

  function openWhy(r: DirectoryRecord) {
    if (openId === r.id) { setOpenId(null); return; }
    const f = fills[r.id] ?? guess(r, siteText[r.id]);
    setOpenId(r.id); setSiteNote(null);
    setFills((m) => ({ ...m, [r.id]: f }));
    setDraft({
      website: f.website?.values[0] ?? "", investor_types: f.investor_types?.values ?? [], capital_types: f.capital_types?.values ?? [], industries: f.industries?.values ?? [],
    });
    setKeep({ website: !!f.website, investor_types: !!f.investor_types, capital_types: !!f.capital_types, industries: !!f.industries });
  }

  async function checkWebsite(r: DirectoryRecord) {
    setChecking(true); setSiteNote(null);
    const res = await postJson<{ text: string; url: string }>(`/api/admin/investor-directory/records/${r.id}/site`, "POST", r.website ? {} : { website: draft.website });
    setChecking(false);
    if (!res.ok) { setSiteNote(res.error); return; }
    setSiteText((m) => ({ ...m, [r.id]: res.data.text }));
    const f = guess(r, res.data.text);
    setFills((m) => ({ ...m, [r.id]: f }));
    setSiteNote(`Read the home page at ${res.data.url}: "${res.data.text.slice(0, 160)}${res.data.text.length > 160 ? "…" : ""}"`);
    setDraft((d) => ({
      website: d.website || (f.website?.values[0] ?? ""),
      investor_types: [...new Set([...d.investor_types, ...(f.investor_types?.values ?? [])])],
      capital_types: [...new Set([...d.capital_types, ...(f.capital_types?.values ?? [])])],
      industries: [...new Set([...d.industries, ...(f.industries?.values ?? [])])],
    }));
    setKeep((k) => ({ website: k.website || !!f.website, investor_types: k.investor_types || !!f.investor_types, capital_types: k.capital_types || !!f.capital_types, industries: k.industries || !!f.industries }));
  }

  async function saveWhy(r: DirectoryRecord, verify: boolean) {
    const miss = missingFields(r);
    const patch: Record<string, unknown> = {};
    for (const f of miss) {
      if (!keep[f]) continue;
      if (f === "website") { if (draft.website.trim()) patch.website = draft.website.trim(); } else if (draft[f].length) patch[f] = draft[f];
    }
    const industries = (patch.industries as string[] | undefined) ?? r.industries;
    if (verify && industries.length === 0) { setResult("Pick at least one industry before verifying."); return; }
    setBusy(true);
    const ok = await savePatch(r.id, patch, verify);
    setBusy(false);
    if (ok) { setResult(verify ? `${r.firm} saved and marked verified.` : `${r.firm} saved.`); setOpenId(null); router.refresh(); }
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
      {mode === "verification" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-[12.5px]">
          <button type="button" disabled={busy || needsFill.length === 0} onClick={fillAll} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 font-medium text-white hover:bg-[#2E78F5] disabled:opacity-45">Fill missing info for this page ({needsFill.length})</button>
          <button type="button" disabled={busy || strongIds.length === 0} onClick={() => void acceptStrong()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-45">Accept all strong ({strongIds.length})</button>
          <span className="text-slate-500">Guesses use the firm name, website domain, email domain, profile text and, when you ask, the fund&apos;s home page. You still check each website before verifying.</span>
          {initial.importId ? <Link href="/admin/investor-directory/verification" className="ml-auto text-[#1A6CE4]">Showing one import only. Show all</Link> : null}
        </div>
      ) : null}
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
              {mode === "verification" ? <th className="hidden px-2 py-2 xl:table-cell">Suggested fill</th> : null}
              <th className="px-2 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
              <tr className="border-b border-slate-50 hover:bg-slate-50">
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
                {mode === "verification" ? (
                  <td className="hidden px-2 py-2 xl:table-cell">
                    {missingFields(r).length === 0 ? <span className="text-[12px] text-slate-400">Nothing missing</span> : fills[r.id] ? (
                      rowLevel(fills[r.id]) === "none" ? <Tag tone="mute">No guess</Tag> : (
                        <div className="space-y-0.5">
                          {FIELDS.filter((f) => fills[r.id][f]).map((f) => (
                            <div key={f} className="flex flex-wrap items-center gap-1">
                              <span className="text-[11.5px] text-slate-500">{FILL_FIELD_LABEL[f]}</span>
                              {fills[r.id][f]!.values.map((v) => <Tag key={v} tone="info">{valueLabel(f, v)}</Tag>)}
                              <Tag tone={fills[r.id][f]!.level === "strong" ? "ok" : "warn"}>{fills[r.id][f]!.level === "strong" ? "Strong" : "Possible"}</Tag>
                            </div>
                          ))}
                          <button type="button" disabled={busy} onClick={() => void accept(r.id)} className="rounded-md bg-[#1A6CE4] px-2 py-0.5 text-[12px] font-medium text-white disabled:opacity-45">Accept</button>
                        </div>
                      )
                    ) : <span className="text-[12px] text-slate-400">Click Fill missing info</span>}
                    <button type="button" onClick={() => openWhy(r)} className="ml-1 text-[12px] text-[#1A6CE4]">{openId === r.id ? "Close" : "Why"}</button>
                  </td>
                ) : null}
                <td className="px-2 py-2 text-right">
                  <span className="inline-flex gap-1">
                    {mode === "records" ? <Tag tone={statusTone[r.status]}>{statusLabel[r.status]}</Tag> : null}
                    <Tag tone={verificationTone[r.verification]}>{verificationLabel[r.verification]}</Tag>
                  </span>
                </td>
              </tr>
              {mode === "verification" && openId === r.id ? (
                <tr className="border-b border-slate-100 bg-slate-50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="text-[12.5px] font-semibold text-slate-800">Why these guesses for {r.firm}</div>
                    {missingFields(r).length === 0 ? <p className="mt-1 text-[12.5px] text-slate-500">Nothing is missing on this record.</p> : null}
                    {FIELDS.filter((f) => missingFields(r).includes(f)).map((f) => {
                      const g = fills[r.id]?.[f];
                      return (
                        <div key={f} className="mt-2 grid gap-1 border-t border-slate-200 pt-2 sm:grid-cols-[150px_1fr]">
                          <label className="flex items-start gap-2 text-[12.5px] font-medium text-slate-800">
                            <input type="checkbox" className="mt-0.5" checked={keep[f]} onChange={(e) => setKeep((k) => ({ ...k, [f]: e.target.checked }))} />{FILL_FIELD_LABEL[f]}
                          </label>
                          <div>
                            {f === "website" ? (
                              <input aria-label="Website" value={draft.website} placeholder="https://" onChange={(e) => { setDraft((d) => ({ ...d, website: e.target.value })); setKeep((k) => ({ ...k, website: true })); }} className="h-8 w-full max-w-sm rounded-md border border-slate-300 px-2 text-[13px]" />
                            ) : (
                              <OptionPicker list={f === "industries" ? "industry" : f === "investor_types" ? "investor_type" : "capital_type"} values={draft[f]} onChange={(v) => { setDraft((d) => ({ ...d, [f]: v })); setKeep((k) => ({ ...k, [f]: true })); }} />
                            )}
                            <div className="mt-1 text-[12px] text-slate-600">
                              {g ? (
                                <>
                                  <Tag tone={g.level === "strong" ? "ok" : "warn"}>{g.level === "strong" ? "Strong" : "Possible"}</Tag>
                                  {g.signals.map((x, i) => <span key={i} className="ml-2">{SOURCE_LABEL[x.source]}: &quot;{x.word}&quot; points to {valueLabel(f, x.value)}.</span>)}
                                </>
                              ) : <span className="text-slate-400">No guess. Pick it by hand, or click Check website.</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <p className="mt-2 text-[12px] text-slate-500">Location, contact names and email addresses are never guessed.</p>
                    {siteNote ? <p className="mt-2 rounded-md bg-white px-2 py-1 text-[12px] text-slate-600">{siteNote}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-slate-500">Checking the website yourself is still the verification step.</span>
                      <span className="flex-1" />
                      <button type="button" disabled={checking || !(r.website || draft.website.trim())} onClick={() => void checkWebsite(r)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700 disabled:opacity-45">{checking ? "Reading…" : r.website || draft.website.trim() ? "Check website" : "No website to check"}</button>
                      <button type="button" disabled={busy} onClick={() => void saveWhy(r, false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700">Save</button>
                      <button type="button" disabled={busy} onClick={() => void saveWhy(r, true)} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white">Save and mark verified</button>
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            ))}          </tbody>
        </table>
      )}
    </div>
  );
}
