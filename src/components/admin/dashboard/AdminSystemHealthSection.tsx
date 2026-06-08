"use client";

import { useState } from "react";
import { AdminButtonHealthPanel } from "@/components/AdminButtonHealthPanel";
import { PageSection } from "@/components/ui/workspace-layout";

export function AdminSystemHealthSection() {
  const [expanded, setExpanded] = useState(false);
  const panelId = "admin-system-health-diagnostics";

  return (
    <PageSection
      title="System Health & Diagnostics"
      subtitle="Admin API testing and configuration — secondary operational tooling"
      action={
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {expanded ? "Collapse" : "Expand diagnostics"}
        </button>
      }
      className="border-t border-slate-200 pt-6"
    >
      {expanded ? (
        <div id={panelId}>
          <AdminButtonHealthPanel />
        </div>
      ) : (
        <p
          id={panelId}
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600"
        >
          Diagnostics collapsed. Expand to run admin API health checks and inspect service role configuration.
        </p>
      )}
    </PageSection>
  );
}
