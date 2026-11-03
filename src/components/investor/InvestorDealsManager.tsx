"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Loader2, CheckCircle2, Clock } from "lucide-react";
import { ListMultiSelect } from "@/components/ui/ListMultiSelect";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { DEAL_AMOUNT_BANDS } from "@/lib/investor/deal-options";

export type DealView = {
  id: string;
  companyName: string;
  stage: string | null;
  amountBands: string[];
  amount: number | null;
  verified: boolean;
  hasProof: boolean;
};

export function InvestorDealsManager({
  deals,
  showTrackRecord,
}: Readonly<{ deals: DealView[]; showTrackRecord: boolean }>) {
  const t = useTranslations("investorCmp");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  // Same list as the investment stage preference on the profile, so the two never drift.
  const stageList = useVocabulary("funding_stage").options;
  const [stages, setStages] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const bandOptions = DEAL_AMOUNT_BANDS.map((b) => ({ value: b, label: b }));
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
            stage: stages.length ? stages.join(", ") : undefined,
            amountBands: bands,
          }),
        }),
      "add",
    );
    if (ok) {
      setCompany("");
      setStages([]);
      setBands([]);
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
                  {[
                    d.stage,
                    d.amountBands.length ? d.amountBands.join(", ") : d.amount != null ? `$${d.amount.toLocaleString()}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
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
        <div className="grid gap-3">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("company_name")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
          />
          <div>
            <p className="mb-1 text-[12px] text-slate-500">Stage (select all that apply)</p>
            <ListMultiSelect
              ariaLabel="Stage"
              options={stageList.map((o) => ({ value: o.label, label: o.label }))}
              selected={stages}
              onChange={setStages}
            />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-slate-500">Amount (select all that apply)</p>
            <ListMultiSelect ariaLabel="Amount" options={bandOptions} selected={bands} onChange={setBands} />
          </div>
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
