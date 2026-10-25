"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { addressLines, type BillingAddress } from "@/lib/billing/address";

const EMPTY: BillingAddress = { company: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "", taxId: "" };

/** Billing address for wire customers. Printed on wire invoices and receipts. */
export function BillingAddressCard({ initial, defaultCompany }: Readonly<{ initial: BillingAddress | null; defaultCompany?: string | null }>) {
  const t = useTranslations("billingManage");
  const router = useRouter();
  const [saved, setSaved] = useState<BillingAddress | null>(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BillingAddress>(initial ?? { ...EMPTY, company: defaultCompany ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: keyof BillingAddress) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("error_generic"));
      setSaved({ ...form });
      setEditing(false);
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof BillingAddress, label: string, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={`addr-${k}`} className="mb-1 block text-xs text-slate-500">{label}</label>
      <input
        id={`addr-${k}`}
        type="text"
        value={form[k]}
        onChange={set(k)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{t("addr_wire_title")}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t("addr_wire_desc")}</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => { setEditing(true); setOk(false); }}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("addr_edit")}
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          {saved ? (
            <div>
              <p className="font-medium text-slate-900">{saved.company}</p>
              {addressLines(saved).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">{t("addr_none")}</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("company", t("addr_company"), true)}
            {field("line1", t("addr_line1"), true)}
            {field("line2", t("addr_line2"), true)}
            {field("city", t("addr_city"))}
            {field("state", t("addr_state"))}
            {field("postalCode", t("addr_postal"))}
            {field("country", t("addr_country"))}
            {field("taxId", t("addr_tax"), true)}
          </div>
          <p className="mt-2 min-h-[1.25rem] text-sm text-red-700" role="alert">{error}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setForm(saved ?? { ...EMPTY, company: defaultCompany ?? "" }); setError(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {t("cancel")}
            </button>
            <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {busy ? t("working") : t("addr_save")}
            </button>
          </div>
        </div>
      )}
      {ok ? <p className="mt-2 text-sm text-emerald-700">{t("addr_saved")}</p> : null}
    </section>
  );
}
