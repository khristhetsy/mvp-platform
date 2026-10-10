"use client";

/** Accounting › Settings: each company's letterhead and the bank transfer details printed on its invoices. */
import { useState } from "react";
import { WIRE_INSTRUCTION_FIELDS, wireInstructionsComplete, type WireInstructions } from "@/lib/billing/wire-core";
import { ENTITIES, type EntityId, type Letterhead, type Service } from "@/lib/accounting/core";
import { ServicesCard } from "@/components/admin/accounting/ServicesCard";
import { LetterheadCard } from "@/components/admin/accounting/LetterheadCard";
import { ErrorLine, Field, Section, Tag, api, inputCls, primaryCls } from "@/components/admin/accounting/ui";

export function SettingsClient({ initial, letterheads, services, plaidReady, plaidEnv }: Readonly<{ initial: Record<EntityId, WireInstructions>; letterheads: Record<EntityId, Letterhead>; services: Service[]; plaidReady: boolean; plaidEnv: string | null }>) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState<EntityId | null>(null);
  const [saved, setSaved] = useState<EntityId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(entity: EntityId) {
    setBusy(entity);
    setError(null);
    setSaved(null);
    const r = await api<{ instructions: WireInstructions }>("/api/admin/accounting/settings", "PUT", { entity, instructions: values[entity] });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setValues({ ...values, [entity]: r.data.instructions });
    setSaved(entity);
  }

  return (
    <div className="space-y-3">
      {ENTITIES.map((e) => <LetterheadCard key={`lh-${e.id}`} entity={e.id} name={e.name} initial={letterheads[e.id]} />)}
      <ServicesCard initial={services} />
      {ENTITIES.map((e) => (
        <Section key={e.id} title={`Bank details on ${e.name} invoices`} icon="ti-building-bank"
          action={wireInstructionsComplete(values[e.id]) ? <Tag tone="ok">Complete</Tag> : <Tag tone="warn">Missing details</Tag>}>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {WIRE_INSTRUCTION_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.key === "notes" || f.key === "bank_address"
                  ? <textarea className={inputCls} rows={2} value={values[e.id][f.key]} onChange={(ev) => setValues({ ...values, [e.id]: { ...values[e.id], [f.key]: ev.target.value } })} />
                  : <input className={inputCls} value={values[e.id][f.key]} onChange={(ev) => setValues({ ...values, [e.id]: { ...values[e.id], [f.key]: ev.target.value } })} />}
              </Field>
            ))}
          </div>
          <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5">
            {e.id === "icfo_capital_global" ? <p className="text-[12px] text-slate-500">Shared with Premium wire invoices in Billing, so both always match.</p> : null}
            {saved === e.id ? <span className="text-[12px] text-[#27500A]">Saved</span> : null}
            <button type="button" className={`${primaryCls} ml-auto`} disabled={busy !== null} onClick={() => save(e.id)}>{busy === e.id ? "Saving…" : "Save"}</button>
          </div>
        </Section>
      ))}
      <ErrorLine text={error} />
      <Section title="Bank feed (Plaid)" icon="ti-plug-connected" action={plaidReady ? <Tag tone="ok">Keys set{plaidEnv ? `, ${plaidEnv}` : ""}</Tag> : <Tag tone="warn">Not set up</Tag>}>
        <div className="space-y-1 px-4 py-3 text-[12.5px] text-slate-600">
          <p>Read only: iCapOS sees transactions and balances and can&apos;t move money. Plaid&apos;s free Trial plan covers up to 10 connected accounts, Bank of America included.</p>
          {!plaidReady ? <p>Add PLAID_CLIENT_ID and PLAID_SECRET (and PLAID_ENV set to production) in Vercel, then redeploy. Connect the bank from Accounting, Bank.</p> : null}
        </div>
      </Section>
    </div>
  );
}
