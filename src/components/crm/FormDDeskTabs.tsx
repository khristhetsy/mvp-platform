"use client";

import { useState } from "react";
import { FormDReviewClient } from "@/components/crm/FormDReviewClient";
import { FormDInvestorDesk } from "@/components/crm/FormDInvestorDesk";

// Form D Desk — one build, two modes (§8). Founders is the existing issuer-side
// filings review; Investors is the firm/deal view over the same staged filings.
export function FormDDeskTabs({ canPromote }: Readonly<{ canPromote: boolean }>) {
  const [mode, setMode] = useState<"founders" | "investors">("founders");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(["founders", "investors"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === m ? "border border-slate-200 bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "founders" ? "Founders" : "Investors"}
          </button>
        ))}
      </div>

      {mode === "founders" ? <FormDReviewClient canPromote={canPromote} /> : <FormDInvestorDesk canPromote={canPromote} />}
    </div>
  );
}
