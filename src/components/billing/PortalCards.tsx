"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, ExternalLink, MapPin } from "lucide-react";

/** Cards and billing address for card plans. Edits happen in the provider's secure portal. */
export function PortalCards({ cardBrand, cardLast4, paymentFailed = false, place }: Readonly<{ cardBrand: string | null; cardLast4: string | null; paymentFailed?: boolean; place?: string | null }>) {
  const t = useTranslations("billingManage");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal(endpoint: "portal" | "update-card" = "portal") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error();
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setError(t("portal_error"));
    } finally {
      setBusy(false);
    }
  }

  const button = (label: string, endpoint: "portal" | "update-card" = "portal") => (
    <button
      type="button"
      disabled={busy}
      onClick={() => void openPortal(endpoint)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </button>
  );

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">{t("cards_title")}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{t("cards_desc")}</p>
          </div>
          {button(t("update_card"), "update-card")}
        </div>
        {paymentFailed ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800" role="alert">{t("card_failed")}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <CreditCard className="h-5 w-5 text-slate-500" aria-hidden />
          <p className="text-sm font-medium text-slate-900">
            {cardLast4 ? t("card_ending", { brand: cardBrand ? cardBrand.replace(/^./, (c) => c.toUpperCase()) : "Card", last4: cardLast4 }) : t("no_card")}
          </p>
          {paymentFailed ? <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">{t("card_failed_pill")}</span> : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("cards_help")}</p>
        <p className="mt-2 min-h-[1rem] text-xs text-red-700" role="alert">{error}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">{t("address_title")}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{t("address_desc")}</p>
          </div>
          {button(t("open_portal"))}
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <div className="text-sm text-slate-600">
            {place ? <p className="font-medium text-slate-900">{t("address_place", { place })}</p> : null}
            <p>{t("address_help")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
