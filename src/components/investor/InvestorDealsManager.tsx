"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Loader2, CheckCircle2, Clock } from "lucide-react";

export type DealView = {
  id: string;
  companyName: string;
  stage: string | null;
  year: number | null;
  amount: number | null;
  verified: boolean;
  hasProof: boolean;
};

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Growth", "Real estate", "Private credit", "Other"];

export function InvestorDealsManager({
  deals,
  showTrackRecord,
}: Readonly<{ deals: DealView[]; showTrackRecord: boolean }>) {
  const t = useTranslations("investorCmp");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState("");
  const [year, setYear] = useState("");
  const [amount, setAmount] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [visible, setVisible] = useState(showTrackRecord);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function call(fn: () => Promise<Response>, key: string) {
    setError(null);
    setBusy(key);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addDeal() {
    if (company.trim().length < 2) {
      setError("Enter the company name.");
      return;
    }
    const ok = await call(
      () =>
        fetch("/api/investor/prior-deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: company.trim(),
            stage: stage || undefined,
            year: year ? Number(year) : undefined,
            amount: amount ? Number(amount) : undefined,
          }),
        }),
      "add",
    );
    if (ok) {
      setCompany("");
      setStage("");
      setYear("");
      setAmount("");
    }
  }

  function uploadProof(dealId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    void call(() => fetch(`/api/investor/prior-deals/${dealId}/proof`, { method: "POST", body }), `proof-${dealId}`);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="space-y-2">
        {deals.map((d) => {
          const proofBusy = busy === `proof-${d.id}`;
          return (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              {d.verified ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={1.9} aria-hidden />
              ) : (
                <Clock className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.9} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{d.companyName}</p>
                <p className="text-[12px] text-slate-500">
                  {[d.stage, d.year, d.amount != null ? `$${d.amount.toLocaleString()}` : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  d.verified ? "bg-emerald-50 text-emerald-700" : d.hasProof ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                {d.verified ? "Verified" : d.hasProof ? "Proof in review" : "Needs proof"}
              </span>
              <input
                ref={(el) => {
                  inputs.current[d.id] = el;
                }}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadProof(d.id, f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                title={t("upload_proof")}
                aria-label={`Upload proof for ${d.companyName}`}
                disabled={proofBusy}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragId(d.id);
                }}
                onDragLeave={() => setDragId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragId(null);
                  const f = e.dataTransfer.files?.[0];
                  if (f) uploadProof(d.id, f);
                }}
                onClick={() => inputs.current[d.id]?.click()}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                  dragId === d.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {proofBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                ) : (
                  <Upload className="h-4 w-4 text-slate-600" strokeWidth={2} aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-label={`Remove ${d.companyName}`}
                disabled={busy === `del-${d.id}`}
                onClick={() => void call(() => fetch(`/api/investor/prior-deals/${d.id}`, { method: "DELETE" }), `del-${d.id}`)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          );
        })}
        {deals.length === 0 ? <p className="text-[13px] text-slate-400">{t("no_deals_added_yet")}</p> : null}
      </div>

      {/* Add deal */}
      <div className="rounded-xl border border-dashed border-slate-300 p-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1.2fr_0.8fr_1fr]">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("company_name")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
          />
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]">
            <option value="">Stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={t("year")}
            inputMode="numeric"
            className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={t("amount")}
            inputMode="numeric"
            className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
          />
        </div>
        <button
          type="button"
          disabled={busy === "add"}
          onClick={() => void addDeal()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden /> : <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
          Add deal
        </button>
      </div>

      {/* Profile visibility toggle */}
      <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={visible}
          onChange={(e) => {
            setVisible(e.target.checked);
            void call(
              () =>
                fetch("/api/investor/prior-deals", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ showTrackRecord: e.target.checked }),
                }),
              "toggle",
            );
          }}
        />
        <span>Show my verified track record on my profile so founders can see my prior deals. Amounts and documents always stay private.</span>
      </label>
    </div>
  );
}
