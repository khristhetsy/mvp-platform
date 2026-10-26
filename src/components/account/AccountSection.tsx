"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2, X, Clock, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DELETE_CONFIRM_PHRASE, DELETION_GRACE_DAYS, isConfirmPhrase } from "@/lib/account/deletion";

/** Founder Settings, Account block: delete your account (30 day grace period). */
export function AccountSection({ companyName }: Readonly<{ companyName?: string | null }>) {
  const t = useTranslations("accountDelete");
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setPhrase("");
    setAck(false);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  async function confirm() {
    if (!isConfirmPhrase(phrase)) {
      setError(t("error_phrase"));
      return;
    }
    if (!ack) {
      setError(t("error_ack"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: phrase }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("error_generic"));
      await createClient().auth.signOut();
      window.location.href = "/auth/sign-in?deleted=1";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error_generic"));
      setBusy(false);
    }
  }

  const rows: Array<{ icon: typeof Trash2; text: string; tone: string }> = [
    { icon: X, text: t("effect_profile"), tone: "text-red-600" },
    { icon: X, text: t("effect_data"), tone: "text-red-600" },
    { icon: X, text: t("effect_team"), tone: "text-red-600" },
    { icon: CreditCard, text: t("effect_plan"), tone: "text-amber-600" },
    { icon: Clock, text: t("effect_restore", { days: DELETION_GRACE_DAYS }), tone: "text-slate-500" },
  ];

  return (
    <section className="mt-6 space-y-3" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-sm font-semibold text-slate-900">{t("section_title")}</h2>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" strokeWidth={1.75} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-red-900">{t("title")}</p>
            <p className="text-xs text-red-700">{t("description", { days: DELETION_GRACE_DAYS })}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          {t("title")}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                <Trash2 className="h-[18px] w-[18px] text-red-600" aria-hidden />
              </span>
              <h3 id="delete-account-title" className="text-base font-semibold text-slate-900">{t("dialog_title")}</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {companyName ? t("dialog_intro_named", { company: companyName }) : t("dialog_intro")}
            </p>

            <ul className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {rows.map(({ icon: Icon, text, tone }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <label htmlFor="delete-confirm" className="mt-4 block text-sm text-slate-700">
              {t("type_pre")} <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> {t("type_post")}
            </label>
            <input
              id="delete-confirm"
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(e) => { setPhrase(e.target.value); setError(null); }}
              placeholder={DELETE_CONFIRM_PHRASE}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={ack} onChange={(e) => { setAck(e.target.checked); setError(null); }} className="mt-1" />
              <span>{t("ack")}</span>
            </label>

            <p className="mt-2 min-h-[1.25rem] text-sm text-red-700" role="alert">{error}</p>

            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? t("deleting") : t("title")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
