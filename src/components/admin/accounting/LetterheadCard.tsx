"use client";

/** Accounting › Settings: one company's letterhead (logo, address, phone, email) for its invoices. */
import { useRef, useState } from "react";
import { LOGO_MAX_BYTES, type Letterhead } from "@/lib/accounting/core";
import { ErrorLine, Field, Section, Tag, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

export function LetterheadCard({ entity, name, initial }: Readonly<{ entity: string; name: string; initial: Letterhead }>) {
  const [lh, setLh] = useState<Letterhead>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickLogo(file: File | undefined) {
    setError(null);
    setSaved(false);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setError("Choose a PNG or JPG image."); return; }
    if (file.size > LOGO_MAX_BYTES) { setError("That image is over 1 MB. Use a smaller one."); return; }
    const reader = new FileReader();
    reader.onload = () => setLh((cur) => ({ ...cur, logo: typeof reader.result === "string" ? reader.result.replace("data:image/jpg;", "data:image/jpeg;") : null }));
    reader.onerror = () => setError("Couldn't read that file. Try another.");
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await api<{ letterhead: Letterhead }>("/api/admin/accounting/letterhead", "PUT", { entity, letterhead: lh });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setLh(r.data.letterhead);
    setSaved(true);
  }

  const complete = Boolean(lh.logo && lh.address);
  return (
    <Section title={`${name} letterhead`} icon="ti-building"
      action={complete ? <Tag tone="ok">Complete</Tag> : <Tag tone="warn">{lh.logo ? "No address yet" : lh.address ? "No logo yet" : "Not set"}</Tag>}>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
        <Field label="Logo" hint="PNG or JPG, up to 1 MB. A wide logo on a white or transparent background prints best.">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-12 w-40 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-white">
              {lh.logo
                // eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview, not a remote image
                ? <img src={lh.logo} alt={`${name} logo`} className="max-h-11 max-w-[150px] object-contain" />
                : <span className="text-[11px] text-slate-400">Preview</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className={btnCls} onClick={() => fileRef.current?.click()}><i className="ti ti-upload" aria-hidden="true" />{lh.logo ? "Replace" : "Upload logo"}</button>
            {lh.logo ? <button type="button" className="text-[12px] text-slate-500 hover:text-red-700" onClick={() => { setLh({ ...lh, logo: null }); setSaved(false); }}>Remove</button> : null}
          </div>
        </Field>
        <Field label="Address" hint="Printed under the company name, one line per row.">
          <textarea className={inputCls} rows={3} value={lh.address} onChange={(e) => { setLh({ ...lh, address: e.target.value }); setSaved(false); }} placeholder={"4225 Executive Sq, Ste 600\nLa Jolla, CA 92037"} />
        </Field>
        <Field label="Phone (optional)"><input className={inputCls} value={lh.phone} onChange={(e) => { setLh({ ...lh, phone: e.target.value }); setSaved(false); }} /></Field>
        <Field label="Email (optional)"><input className={inputCls} type="email" value={lh.email} onChange={(e) => { setLh({ ...lh, email: e.target.value }); setSaved(false); }} placeholder="billing@company.com" /></Field>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5">
        <ErrorLine text={error} />
        {saved ? <span className="text-[12px] text-[#27500A]">Saved. New and existing invoice PDFs use it.</span> : null}
        <button type="button" className={`${primaryCls} ml-auto`} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Section>
  );
}
