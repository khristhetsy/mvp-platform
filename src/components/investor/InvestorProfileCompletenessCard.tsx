"use client";

import type { InvestorProfileRecord } from "@/lib/investor/types";
import { useTranslations } from "next-intl";

type FieldStatus = {
  label: string;
  done: boolean;
  hint: string;
};

function computeFields(profile: InvestorProfileRecord): FieldStatus[] {
  return [
    {
      label: "Investor type",
      done: Boolean(profile.investor_type?.trim()),
      hint: "Helps founders understand who you are",
    },
    {
      label: "Investment thesis",
      done: Boolean(profile.investment_thesis?.trim() && profile.investment_thesis.trim().length >= 50),
      hint: "50+ characters — powers the AI deal brief",
    },
    {
      label: "Preferred sectors",
      done: profile.preferred_sectors.length > 0,
      hint: "Drives sector-based match scoring",
    },
    {
      label: "Preferred stages",
      done: profile.preferred_stages.length > 0,
      hint: "Filters companies to your stage focus",
    },
    {
      label: "Preferred geographies",
      done: profile.preferred_geographies.length > 0,
      hint: "Improves location-based matching",
    },
    {
      label: "Check size range",
      done: Boolean(profile.check_size_min || profile.check_size_max),
      hint: "Matches you to appropriately-sized rounds",
    },
    {
      label: "Accreditation status",
      done: profile.accredited_status,
      hint: "Required for certain deal types",
    },
    {
      label: "Contact preference",
      done: Boolean(profile.contact_preference?.trim()),
      hint: "Tells founders how to reach you",
    },
  ];
}

function CircleProgress({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#6366f1" : "#f59e0b";

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InvestorProfileCompletenessCard({
  profile,
}: {
  profile: InvestorProfileRecord;
}) {
  const t = useTranslations("investorCmp");
  const fields = computeFields(profile);
  const doneCount = fields.filter((f) => f.done).length;
  const pct = Math.round((doneCount / fields.length) * 100);
  const missing = fields.filter((f) => !f.done);

  if (pct === 100) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="text-xl">✓</span>
        <div>
          <p className="text-sm font-semibold text-emerald-900">{t("profile_complete")}</p>
          <p className="text-xs text-emerald-700">
            Your profile is fully filled out — you&apos;ll get the best match scores and AI deal briefs.
          </p>
        </div>
      </div>
    );
  }

  const color = pct >= 80 ? "text-emerald-700" : pct >= 50 ? "text-indigo-700" : "text-amber-700";
  const bgCard = pct >= 80 ? "border-emerald-200 bg-emerald-50/40" : pct >= 50 ? "border-indigo-200 bg-indigo-50/30" : "border-amber-200 bg-amber-50/30";

  return (
    <div className={`mb-6 rounded-xl border ${bgCard} p-4`}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <CircleProgress pct={pct} />
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>
            {pct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Profile {pct}% complete
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {doneCount}/{fields.length} fields filled — a complete profile improves match scores and unlocks AI-powered deal briefs.
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Missing fields
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {missing.map((field) => (
              <div
                key={field.label}
                className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 ring-1 ring-inset ring-slate-200"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <p className="text-xs font-medium text-slate-800">{field.label}</p>
                  <p className="text-[10px] text-slate-500">{field.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
