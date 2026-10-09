"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { CompanyListingState } from "@/lib/listing/listing-server";
import type { ListingItemKey } from "@/lib/listing/checklist";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";

export type ListingFigures = {
  arr: string | null;
  mrr: string | null;
  annualRevenue: string | null;
  capTableSummary: string | null;
  fundingAmount: number | null;
};

type Panel = "attested" | "opt_in" | null;

const OPT_IN_COPY =
  "Your listing summary (name, sector, stage, location, amount raising, description, CRR) is shown to matched investors in our 7,000+ network. Your documents stay private until you share them.";

function shown(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

function money(n: number | null): string | null {
  if (n === null || !Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/**
 * "Complete due diligence to get listed": the four Private Market checks on
 * the founder dashboard, with the action for each one inline. Any CRR
 * qualifies; the founder confirms the figures and opts in themselves.
 */
export function ListingChecklistCard({
  initial,
  figures,
}: Readonly<{ initial: CompanyListingState; figures: ListingFigures }>) {
  const router = useRouter();
  const [state, setState] = useState<CompanyListingState>(initial);
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => null)) as { error?: string; checklist?: CompanyListingState } | null;
      if (!res.ok || !j?.checklist) throw new Error(j?.error ?? "Something went wrong. Please try again.");
      setState(j.checklist);
      setPanel(null);
      setConfirmed(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const listed = state.complete && Boolean(state.listingCompletedAt);

  if (listed) {
    return (
      <WorkspacePanel
        title="You're listed in the Private Market"
        subtitle={`Listed since ${formatPlatformDateTime(state.listingCompletedAt as string, { dateStyle: "medium" })}. Matched investors in our network can see your listing summary. Your documents stay private until you share them.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void post("/api/founder/listing/opt-in", { optIn: false })}
              className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--navy)] disabled:opacity-60"
            >
              {busy ? "Unlisting…" : "Unlist"}
            </button>
            <Link href="/founder/investor-interest" className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-sm font-medium">
              See investor interest
            </Link>
          </div>
        }
      >
        {err ? <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p> : null}
        <p className="flex items-center gap-2 text-sm text-slate-700">
          <i className="ti ti-circle-check-filled text-[18px] text-emerald-600" aria-hidden="true" />
          All 4 due diligence checks are complete.
        </p>
      </WorkspacePanel>
    );
  }

  const pct = Math.round((state.doneCount / state.total) * 100);

  function action(key: ListingItemKey) {
    const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--navy)] hover:bg-slate-50";
    switch (key) {
      case "documents":
        return <Link href="/founder/documents" className={btn}>Upload documents</Link>;
      case "report":
        return <Link href="/founder/report" className={btn}>Go to report</Link>;
      case "attested":
        return (
          <button type="button" className={btn} aria-expanded={panel === "attested"} onClick={() => setPanel(panel === "attested" ? null : "attested")}>
            Confirm
          </button>
        );
      case "opt_in":
        return (
          <button type="button" className={btn} aria-expanded={panel === "opt_in"} onClick={() => setPanel(panel === "opt_in" ? null : "opt_in")}>
            Opt in
          </button>
        );
    }
  }

  const figureRows: Array<{ label: string; value: string | null }> = [
    { label: "Annual recurring revenue (ARR)", value: shown(figures.arr) },
    { label: "Monthly recurring revenue (MRR)", value: shown(figures.mrr) },
    { label: "Annual revenue", value: shown(figures.annualRevenue) },
    { label: "Amount raising", value: money(figures.fundingAmount) },
    { label: "Cap table summary", value: shown(figures.capTableSummary) },
  ];

  return (
    <WorkspacePanel
      title="Complete due diligence to get listed"
      subtitle={`${state.doneCount} of ${state.total} complete. Your company is matched with investors when all ${state.total} are done.`}
      action={
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {state.doneCount} of {state.total}
        </span>
      }
    >
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-valuenow={state.doneCount}
        aria-label="Listing checklist progress"
      >
        <div className="h-full rounded-full bg-[#1A6CE4]" style={{ width: `${pct}%` }} />
      </div>

      {err ? <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p> : null}

      {state.complete ? (
        <p className="mb-3 text-sm text-slate-600">All 4 checks are done. Your listing is being prepared.</p>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {state.items.map((item) => (
          <li key={item.key} className="py-3">
            <div className="flex items-start gap-3">
              {item.done ? (
                <i className="ti ti-circle-check-filled mt-0.5 text-[18px] text-emerald-600" aria-label="Done" />
              ) : (
                <i className="ti ti-circle mt-0.5 text-[18px] text-slate-300" aria-label="Not done" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${item.done ? "text-slate-500" : "text-slate-900"}`}>{item.label}</p>
                {item.detail ? <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p> : null}
              </div>
              {item.done ? null : <div className="shrink-0">{action(item.key)}</div>}
            </div>

            {panel === "attested" && item.key === "attested" ? (
              <div className="ml-8 mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Figures on your company profile</p>
                <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {figureRows.map((r) => (
                    <div key={r.label} className="min-w-0">
                      <dt className="text-xs text-slate-500">{r.label}</dt>
                      <dd className={`text-sm ${r.value ? "text-slate-900" : "italic text-slate-400"} whitespace-pre-line break-words`}>
                        {r.value ?? "Not provided"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-slate-600">
                  Something wrong or missing?{" "}
                  <Link href="/founder/settings" className="font-medium text-[#1A6CE4] hover:text-[#2E78F5]">
                    Edit company settings
                  </Link>
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  I confirm these figures are accurate
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--navy)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!confirmed || busy}
                    onClick={() => void post("/api/founder/listing/attest", { confirm: true })}
                    className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Confirm"}
                  </button>
                </div>
              </div>
            ) : null}

            {panel === "opt_in" && item.key === "opt_in" ? (
              <div className="ml-8 mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700">{OPT_IN_COPY}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="cap-btn-secondary rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-[var(--navy)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post("/api/founder/listing/opt-in", { optIn: true })}
                    className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-sm font-medium disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Opt in"}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Any Capital Readiness Rating qualifies. Listing does not guarantee investor interest or funding. iCFO Capital does not
        solicit securities and is not an investment adviser. Content is for educational purposes only.
      </p>
    </WorkspacePanel>
  );
}
