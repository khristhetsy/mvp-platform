"use client";

/**
 * Pricing — Plans / Where it shows / History.
 *
 * Plans: edit the amount and the words for each plan. Saving appends a version
 * and makes it active; nothing is edited in place, so past months keep reporting
 * what was actually billed.
 *
 * LemonSqueezy is the one thing this screen can't change — their prices are
 * immutable and not writable through their API. We read the variant and warn
 * loudly when the two disagree, because a mismatch means the site quotes one
 * number and the customer is charged another.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PLAN_SHORT, money, priceLabel, priceSublabel,
  type PriceDiffRow, type PriceSurface, type PricedPlan, type PricedPlanKey, type PricingCatalog,
} from "@/lib/subscriptions/pricing-catalog";

type Provider = { plan: PricedPlanKey; variantId: string | null; priceCents: number | null; name: string | null; matches: boolean | null };
type HistoryEntry = PricingCatalog & { diff: PriceDiffRow[]; summary: string };
type Payload = {
  active: PricingCatalog;
  sets: HistoryEntry[];
  counts: Record<string, number>;
  provider: Provider[];
  surfaces: PriceSurface[];
  shape: { plans: Array<{ key: PricedPlanKey; label: string }>; codeDefaults: PricingCatalog };
};
type Draft = { plans: Record<PricedPlanKey, PricedPlan>; addCompanyCents: number };
type Tab = "plans" | "surfaces" | "history";

const card = "rounded-xl border border-slate-200 bg-white";
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPri = "rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500";
const td = "border-t border-slate-100 px-3 py-2 align-top text-[12.5px] text-slate-700";
const fmtAt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const draftOf = (c: PricingCatalog): Draft => JSON.parse(JSON.stringify({ plans: c.plans, addCompanyCents: c.addCompanyCents }));

/** Dollars in the box, cents in the model — nobody types 19900. */
function dollars(cents: number) { return (cents / 100).toString(); }
function toCents(text: string) { const n = Number(text.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; }

export default function PricingAdminClient({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>("plans");
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [revert, setRevert] = useState<HistoryEntry | null>(null);
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/pricing");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Couldn't load pricing."); return; }
    setData(j); setDraft((d) => d ?? draftOf(j.active)); setError(null);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(
    () => Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(draftOf(data.active))),
    [data, draft],
  );
  /** The catalogue as edited — what every preview on this screen renders from. */
  const candidate: PricingCatalog | null = data && draft ? { ...data.active, ...draft } : null;

  function setPlan(key: PricedPlanKey, patch: Partial<PricedPlan>) {
    setDraft((s) => (s ? { ...s, plans: { ...s.plans, [key]: { ...s.plans[key], ...patch } } } : s));
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    const r = await fetch("/api/admin/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "That didn't work."); return null; }
    return j;
  }

  async function doSave(version: string, reason: string, existingPolicy: "grandfather" | "migrate", effectiveAt: string | null) {
    const j = await post({ action: "save", ...draft, version, reason, existingPolicy, effectiveAt });
    if (!j) return;
    setSaveOpen(false);
    setNotice(`Saved ${j.set.version} — ${j.summary}.`);
    setDraft(draftOf(j.set)); await load(); setTab("history");
  }
  async function doRevert(entry: HistoryEntry, reason: string) {
    const j = await post({ action: "revert", id: entry.id, reason });
    if (!j) return;
    setRevert(null);
    setNotice(`Reverted to ${entry.version} as ${j.set.version}.`);
    setDraft(draftOf(j.set)); await load();
  }

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-[13px] ${tab === t ? "border-indigo-600 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
  );

  if (!data || !draft || !candidate) {
    return <p className="text-[13px] text-slate-500">{error ?? "Loading pricing…"}</p>;
  }

  const mismatches = data.provider.filter((p) => p.matches === false);

  return (
    <div>
      <div className="mb-4 flex border-b border-slate-200">{tabBtn("plans", "Plans")}{tabBtn("surfaces", "Where it shows")}{tabBtn("history", "History")}</div>

      {error ? <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div> : null}
      {notice ? <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800"><span className="flex-1">{notice}</span><button type="button" onClick={() => setNotice(null)}>✕</button></div> : null}

      {tab === "plans" ? (
        <div className={card}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-[14px] font-semibold text-slate-900">Pricing</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              What each plan costs, what customers are told it costs, and what LemonSqueezy actually charges.
              Saving writes a new version — nothing is edited in place. Active: <span className="font-medium text-slate-700">{data.active.version}</span>.
            </p>
          </div>

          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Plan</th>
                <th className={th}>Price / mo</th>
                <th className={th}>Shown as</th>
                <th className={th}>Sub-label</th>
                <th className={th}>LemonSqueezy</th>
                <th className={`${th} text-right`}>On this plan</th>
              </tr>
            </thead>
            <tbody>
              {data.shape.plans.map(({ key, label }) => {
                const p = draft.plans[key];
                const prov = data.provider.find((v) => v.plan === key);
                return (
                  <tr key={key}>
                    <td className={td}>
                      <div className="font-semibold text-slate-900">{label}</div>
                      <div className="font-mono text-[11px] text-slate-400">{key}</div>
                    </td>
                    <td className={td}>
                      <span className="text-slate-400">$</span>
                      <input
                        aria-label={`${label} price in dollars`}
                        value={dollars(p?.cents ?? 0)}
                        disabled={!canEdit || key === "founder_free"}
                        onChange={(e) => setPlan(key, { cents: toCents(e.target.value) })}
                        className="ml-1 w-[86px] rounded-md border border-slate-300 px-2 py-1 text-right text-[13px] tabular-nums disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </td>
                    <td className={td}>
                      <input
                        aria-label={`${label} label`}
                        placeholder={money(p?.cents ?? 0)}
                        value={p?.label ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => setPlan(key, { label: e.target.value || null })}
                        className="w-[150px] rounded-md border border-slate-300 px-2 py-1 text-[13px]"
                      />
                      <div className="mt-1 text-[11px] text-slate-400">{p?.label?.trim() ? "words instead of the amount" : "derived from the amount"}</div>
                    </td>
                    <td className={td}>
                      <input
                        aria-label={`${label} sub-label`}
                        value={p?.sublabel ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => setPlan(key, { sublabel: e.target.value || null })}
                        className="w-[130px] rounded-md border border-slate-300 px-2 py-1 text-[13px]"
                      />
                    </td>
                    <td className={td}>
                      {!prov?.variantId ? (
                        <span className="text-slate-400">{p?.contactSales ? "no checkout — sales-led" : "no variant configured"}</span>
                      ) : prov.priceCents === null ? (
                        <span className="text-slate-400">variant {prov.variantId} · couldn&rsquo;t read</span>
                      ) : (
                        <span className={prov.matches === false ? "font-semibold text-amber-700" : "text-slate-600"}>
                          variant {prov.variantId} · {money(prov.priceCents)}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{data.counts[key] ?? 0}</td>
                  </tr>
                );
              })}
              <tr>
                <td className={td}>
                  <div className="font-semibold text-slate-900">Additional company</div>
                  <div className="text-[11px] text-slate-400">add-on · Professional only</div>
                </td>
                <td className={td}>
                  <span className="text-slate-400">$</span>
                  <input
                    aria-label="Additional company price in dollars"
                    value={dollars(draft.addCompanyCents)}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((s) => (s ? { ...s, addCompanyCents: toCents(e.target.value) } : s))}
                    className="ml-1 w-[86px] rounded-md border border-slate-300 px-2 py-1 text-right text-[13px] tabular-nums"
                  />
                </td>
                <td className={td} colSpan={3}><span className="text-slate-400">Quoted in the “add a company” refusal message.</span></td>
                <td className={`${td} text-right tabular-nums`}>—</td>
              </tr>
            </tbody>
          </table>

          {mismatches.length ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
              <p>
                <b>{mismatches.map((m) => PLAN_SHORT[m.plan] ?? m.plan).join(" and ")}</b> {mismatches.length === 1 ? "doesn’t" : "don’t"} match LemonSqueezy.
                {mismatches.map((m) => (
                  <span key={m.plan}> You&rsquo;ve set {money(data.active.plans[m.plan]?.cents ?? 0)} but variant {m.variantId} still charges {money(m.priceCents ?? 0)}.</span>
                ))}
                {" "}New customers would be billed the LemonSqueezy amount while every screen shows yours. LemonSqueezy prices can&rsquo;t be edited through their API — change it there first.
              </p>
              <button type="button" onClick={() => void load()} className={`${btn} mt-2`}>Re-check</button>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
            <button type="button" className={btn} disabled={!dirty} onClick={() => setDraft(draftOf(data.active))}>Reset</button>
            <button type="button" className={btn} disabled={!dirty} onClick={() => setTab("surfaces")}>Preview where it shows</button>
            <div className="flex-1" />
            {dirty ? <span className="text-[12px] text-slate-500">Unsaved changes</span> : null}
            <button type="button" className={btnPri} disabled={!canEdit || !dirty || busy} onClick={() => setSaveOpen(true)}>Save new version…</button>
          </div>
        </div>
      ) : null}

      {tab === "surfaces" ? (
        <div className={card}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-[14px] font-semibold text-slate-900">Where it shows</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Every place a price reaches a human, rendered from {dirty ? "your unsaved edits" : `the active version (${data.active.version})`}.
              Amber rows are copy a person writes — listed so you know to change them, never rewritten from here.
            </p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className={th}>Surface</th><th className={th}>Who sees it</th><th className={th}>Renders</th><th className={th}>Status</th></tr></thead>
            <tbody>
              {/* Rendered from the DRAFT, so the table answers "what would this change?" */}
              {surfacesFor(candidate, data.surfaces).map((s) => (
                <tr key={s.where}>
                  <td className={td}>{s.where}{s.note ? <div className="text-[11px] text-slate-400">{s.note}</div> : null}</td>
                  <td className={td}>{s.audience}</td>
                  <td className={`${td} tabular-nums`}>{s.renders}</td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                      s.status === "follows" ? "bg-emerald-50 text-emerald-700"
                        : s.status === "flagged" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {s.status === "follows" ? "follows the catalogue" : s.status === "flagged" ? "written by hand" : "provider-side"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className={card}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-[14px] font-semibold text-slate-900">History</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Every save, what moved, and how existing customers were treated. Historical MRR is never rewritten.</p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className={th}>Version</th><th className={th}>Change</th><th className={th}>When</th><th className={th}>Existing customers</th><th className={th}>Why</th><th className={th} /></tr></thead>
            <tbody>
              {data.sets.map((s) => (
                <tr key={s.id ?? s.version}>
                  <td className={td}>
                    <button type="button" onClick={() => setOpenVersion(openVersion === s.version ? null : s.version)} className="font-semibold text-slate-900 hover:underline">{s.version}</button>
                    {s.isActive ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">active</span> : null}
                    {openVersion === s.version ? (
                      <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-500">
                        {s.diff.length ? s.diff.map((d, i) => (
                          <li key={i}>{PLAN_SHORT[d.plan] ?? d.plan} {d.field}: {d.before} → {d.after}</li>
                        )) : <li>Seeded from the code constants.</li>}
                      </ul>
                    ) : null}
                  </td>
                  <td className={td}>{s.summary}</td>
                  <td className={td}>{fmtAt(s.createdAt)}</td>
                  <td className={td}>{s.existingPolicy === "migrate" ? "migrated at the provider" : "grandfathered"}</td>
                  <td className={td}>{s.reason ?? "—"}</td>
                  <td className={`${td} text-right`}>
                    {!s.isActive && canEdit ? <button type="button" className={btn} onClick={() => setRevert(s)}>Revert</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {saveOpen ? (
        <SaveDialog
          current={data.active}
          candidate={candidate}
          counts={data.counts}
          busy={busy}
          onCancel={() => setSaveOpen(false)}
          onSave={doSave}
        />
      ) : null}

      {revert ? (
        <RevertDialog entry={revert} busy={busy} onCancel={() => setRevert(null)} onConfirm={(reason) => doRevert(revert, reason)} />
      ) : null}
    </div>
  );
}

/** Re-render the surface table against whatever the editor currently holds. */
function surfacesFor(candidate: PricingCatalog, fallback: PriceSurface[]): PriceSurface[] {
  const basic = priceLabel(candidate, "founder_basic");
  const pro = priceLabel(candidate, "founder_professional");
  const pair = `${basic} · ${pro}`;
  return fallback.map((s) => {
    if (s.status !== "follows") return s;
    if (s.where.includes("Add a company")) return { ...s, renders: `${money(candidate.addCompanyCents)}/mo` };
    if (s.where.includes("CTA")) return { ...s, renders: `Founder Basic — ${basic}/mo` };
    if (s.renders.includes("·")) return { ...s, renders: s.renders.includes("/month") ? `${pair} /month` : pair };
    return s;
  });
}

function SaveDialog({ current, candidate, counts, busy, onCancel, onSave }: {
  current: PricingCatalog;
  candidate: PricingCatalog;
  counts: Record<string, number>;
  busy: boolean;
  onCancel: () => void;
  onSave: (version: string, reason: string, policy: "grandfather" | "migrate", effectiveAt: string | null) => void;
}) {
  const [version, setVersion] = useState("");
  const [reason, setReason] = useState("");
  const [policy, setPolicy] = useState<"grandfather" | "migrate">("grandfather");
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState("");

  const moved = (["founder_basic", "founder_professional", "founder_managed_ir"] as PricedPlanKey[])
    .filter((k) => current.plans[k]?.cents !== candidate.plans[k]?.cents);
  const affected = moved.reduce((n, k) => n + (counts[k] ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-slate-900">Save new pricing version</h3>
        <ul className="mt-2 space-y-0.5 text-[12.5px] text-slate-600">
          {moved.length ? moved.map((k) => (
            <li key={k}>{PLAN_SHORT[k]} {money(current.plans[k]?.cents ?? 0)} → <b>{money(candidate.plans[k]?.cents ?? 0)}</b> {priceSublabel(candidate, k)}</li>
          )) : <li>Label changes only — no amount moves.</li>}
        </ul>

        <label className="mt-4 block text-[12px] font-medium text-slate-700">Why (recorded in the history)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px]" placeholder="Repricing for the self-serve tier" />
        </label>

        <fieldset className="mt-4">
          <legend className="text-[12px] font-medium text-slate-700">Existing {affected} paying customer{affected === 1 ? "" : "s"}</legend>
          <label className="mt-1 flex items-start gap-2 text-[12.5px] text-slate-700">
            <input type="radio" name="policy" checked={policy === "grandfather"} onChange={() => setPolicy("grandfather")} className="mt-0.5" />
            <span>Grandfather — they keep their current LemonSqueezy price; the app shows each customer their own.</span>
          </label>
          <label className="mt-1 flex items-start gap-2 text-[12.5px] text-slate-700">
            <input type="radio" name="policy" checked={policy === "migrate"} onChange={() => setPolicy("migrate")} className="mt-0.5" />
            <span>Migrate them in LemonSqueezy, then record here that they were moved.</span>
          </label>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-[12px] font-medium text-slate-700">Takes effect</legend>
          <label className="mt-1 flex items-center gap-2 text-[12.5px] text-slate-700">
            <input type="radio" name="when" checked={!later} onChange={() => setLater(false)} /> Immediately
          </label>
          <label className="mt-1 flex items-center gap-2 text-[12.5px] text-slate-700">
            <input type="radio" name="when" checked={later} onChange={() => setLater(true)} /> On
            <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} disabled={!later} className="rounded-md border border-slate-300 px-2 py-1 text-[12.5px] disabled:bg-slate-50" />
          </label>
        </fieldset>

        <label className="mt-4 block text-[12px] font-medium text-slate-700">Version name (optional)
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="auto" className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px]" />
        </label>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
          Historical MRR is not rewritten — months already recorded keep reporting what was actually billed.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onCancel}>Cancel</button>
          <button type="button" className={btnPri} disabled={busy || !reason.trim()} onClick={() => onSave(version, reason, policy, later && when ? when : null)}>Save version</button>
        </div>
      </div>
    </div>
  );
}

function RevertDialog({ entry, busy, onCancel, onConfirm }: { entry: HistoryEntry; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState(`Reverting to ${entry.version}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-semibold text-slate-900">Revert to {entry.version}</h3>
        <p className="mt-1 text-[12.5px] text-slate-600">This copies those prices forward as a new version. {entry.version} itself is left alone.</p>
        <label className="mt-3 block text-[12px] font-medium text-slate-700">Why
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px]" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onCancel}>Cancel</button>
          <button type="button" className={btnPri} disabled={busy || !reason.trim()} onClick={() => onConfirm(reason)}>Revert</button>
        </div>
      </div>
    </div>
  );
}
