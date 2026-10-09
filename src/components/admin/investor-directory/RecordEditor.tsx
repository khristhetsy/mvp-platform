"use client";

/**
 * One directory record, laid out like a Sales contact: Contact, then the
 * Investor profile on the same option lists. Each value carries a tag for
 * where it came from. Industries are required before "Save and mark
 * verified", because the matcher scores on them.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OptionPicker, Tag, fmtPT, money, postJson, statusLabel, statusTone, verificationLabel, verificationTone } from "@/components/admin/investor-directory/ui";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { DirectoryRecord } from "@/lib/investor-directory/types";
import type { VocabularyList } from "@/lib/vocabulary/lists";

type Draft = Pick<DirectoryRecord,
  "firm" | "contact_name" | "title" | "email" | "phone" | "website" | "city" | "state" | "fund_name" | "strategy" | "notes"
  | "investor_types" | "funding_stages" | "capital_types" | "industries" | "investing_now">;

const TEXT_FIELDS: { key: keyof Draft; label: string; type?: string }[] = [
  { key: "firm", label: "Firm" },
  { key: "contact_name", label: "Contact" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
];

const PROFILE: { key: "investor_types" | "funding_stages" | "capital_types" | "industries"; label: string; list: VocabularyList }[] = [
  { key: "investor_types", label: "Investor types", list: "investor_type" },
  { key: "funding_stages", label: "Funding stages", list: "funding_stage" },
  { key: "capital_types", label: "Capital", list: "capital_type" },
  { key: "industries", label: "Industries", list: "industry" },
];

export function RecordEditor({ record }: Readonly<{ record: DirectoryRecord }>) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    firm: record.firm, contact_name: record.contact_name, title: record.title, email: record.email, phone: record.phone,
    website: record.website, city: record.city, state: record.state, fund_name: record.fund_name, strategy: record.strategy,
    notes: record.notes, investor_types: record.investor_types, funding_stages: record.funding_stages,
    capital_types: record.capital_types, industries: record.industries, investing_now: record.investing_now,
  });
  const [current, setCurrent] = useState(record);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [industryError, setIndustryError] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setMsg(null); };
  const sourceTag = <Tag tone="info">{current.source.split(" (")[0]}</Tag>;
  const changedFromSource = (k: keyof Draft) => JSON.stringify(draft[k]) !== JSON.stringify(record[k]);

  async function run(action: "save" | "verify" | "publish" | "unpublish" | "suppress" | "opt_out") {
    if (action === "verify" && draft.industries.length === 0) { setIndustryError(true); return; }
    if (action === "opt_out" && !(await confirmDialog({
      message: "Record an opt-out? The investor is suppressed and removed from every founder's list. This can't be undone from here.",
      danger: true, confirmLabel: "Record opt-out",
    }))) return;
    setBusy(action);
    const r = await postJson<{ record: DirectoryRecord }>(`/api/admin/investor-directory/records/${record.id}`, "PATCH", {
      action, patch: { ...draft, email: draft.email ?? "" },
    });
    setBusy(null);
    if (!r.ok) { setMsg({ text: r.error, bad: true }); return; }
    setCurrent(r.data.record);
    setMsg({ text: { save: "Saved.", verify: "Saved and marked verified.", publish: "Published to founders.", unpublish: "Moved to draft.", suppress: "Suppressed.", opt_out: "Opt-out recorded." }[action] });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">{current.firm}</h1>
        <Tag tone="pro">Directory</Tag>
        <Tag tone={statusTone[current.status]}>{statusLabel[current.status]}</Tag>
        <Tag tone={verificationTone[current.verification]}>{verificationLabel[current.verification]}</Tag>
        {current.in_network ? <Tag tone="ok">In iCFO network, hidden from founders</Tag> : null}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-50 px-4 py-2 text-[12px] font-semibold text-slate-700">Contact</div>
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-2 text-[13px]">
            <span className="text-slate-500">{f.label}</span>
            <span className="flex items-center gap-2">
              <input
                type={f.type ?? "text"}
                value={(draft[f.key] as string | null) ?? ""}
                onChange={(e) => set(f.key, (e.target.value || null) as never)}
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-[13px]"
              />
              {draft[f.key] && !changedFromSource(f.key) ? sourceTag : null}
              {changedFromSource(f.key) ? <Tag tone="mute">Edited</Tag> : null}
            </span>
          </label>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-50 px-4 py-2 text-[12px] font-semibold text-slate-700">Investor profile</div>
        {PROFILE.map((f) => {
          const missing = f.key === "industries" && draft.industries.length === 0;
          return (
            <div key={f.key} className={`grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-slate-100 px-4 py-2.5 text-[13px] ${missing ? "bg-[#FAEEDA]" : ""}`}>
              <span className={missing ? "font-medium text-[#633806]" : "text-slate-500"}>{f.label}</span>
              <div>
                <OptionPicker list={f.list} values={draft[f.key]} onChange={(v) => { set(f.key, v); if (f.key === "industries") setIndustryError(false); }} />
                {f.key === "funding_stages" && current.strategy ? <p className="mt-1 text-[11.5px] text-slate-500">Source strategy: {current.strategy}</p> : null}
                {f.key === "capital_types" && (current.fund_size || current.avg_investment) ? (
                  <p className="mt-1 text-[11.5px] text-slate-500">Fund {money(current.fund_size)} · avg check {money(current.avg_investment)}</p>
                ) : null}
                {missing ? <p className={`mt-1 text-[11.5px] ${industryError ? "text-[#A32D2D]" : "text-[#633806]"}`}>Pick at least one industry from the fund&apos;s website. Required before verifying.</p> : null}
              </div>
            </div>
          );
        })}
        <label className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-2 text-[13px]">
          <span className="text-slate-500">Investing now</span>
          <select value={draft.investing_now === null ? "" : draft.investing_now ? "yes" : "no"} onChange={(e) => set("investing_now", e.target.value === "" ? null : e.target.value === "yes")} className="h-8 w-40 rounded-md border border-slate-300 px-2 text-[13px]">
            <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
        <label className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
          <span className="pt-1 text-slate-500">Notes</span>
          <textarea value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1 text-[13px]" />
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12.5px] text-slate-600">
        <div>Source: {current.source_url ? <a href={current.source_url} target="_blank" rel="noopener noreferrer" className="text-[#1A6CE4]">{current.source}</a> : current.source}</div>
        <div>Verified: {current.verified_at ? fmtPT(current.verified_at) : "Not yet"} · Updated {fmtPT(current.updated_at, true)}</div>
        {current.opted_out_at ? <div className="text-[#A32D2D]">Opted out {fmtPT(current.opted_out_at, true)}</div> : null}
      </section>

      {msg ? <p className={`text-[13px] ${msg.bad ? "text-[#A32D2D]" : "text-[#27500A]"}`}>{msg.text}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy} onClick={() => void run("opt_out")} className="rounded-lg border border-[#F7C1C1] px-3 py-1.5 text-[12.5px] text-[#A32D2D] hover:bg-[#FCEBEB]">Record opt-out</button>
        <button type="button" disabled={!!busy} onClick={() => void run("suppress")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Suppress</button>
        {current.status === "published"
          ? <button type="button" disabled={!!busy} onClick={() => void run("unpublish")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Move to draft</button>
          : current.verification !== "opt_out" ? <button type="button" disabled={!!busy} onClick={() => void run("publish")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">Publish</button> : null}
        <span className="flex-1" />
        <button type="button" disabled={!!busy} onClick={() => void run("save")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50">{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" disabled={!!busy} onClick={() => void run("verify")} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{busy === "verify" ? "Saving…" : "Save and mark verified"}</button>
      </div>
    </div>
  );
}
