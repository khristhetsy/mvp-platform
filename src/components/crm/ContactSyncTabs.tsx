"use client";

import { useState, type ReactNode } from "react";
import { LinkedInImportTab } from "@/components/crm/LinkedInImportTab";

type Tab = "connectors" | "linkedin";

// Tab shell for the Contact Sync page. The existing connector cards are passed in as a
// slot so they render unchanged; the LinkedIn import lives in its own tab.
export function ContactSyncTabs({ connectorsSlot }: { connectorsSlot: ReactNode }) {
  const [tab, setTab] = useState<Tab>("connectors");

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Contact sync">
        {([["connectors", "Connectors"], ["linkedin", "LinkedIn"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === id ? "border-[#1A6CE4] text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {id === "linkedin" && <i className="ti ti-brand-linkedin" style={{ fontSize: 16 }} aria-hidden />}
            {label}
          </button>
        ))}
      </div>

      {tab === "connectors" ? connectorsSlot : <LinkedInImportTab />}
    </div>
  );
}
