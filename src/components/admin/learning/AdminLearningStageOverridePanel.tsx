"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { CapitalStage } from "@/lib/learning/capital-stages";
import { CAPITAL_STAGE_UNLOCK_THRESHOLD } from "@/lib/learning/capital-stages";

type StageRow = {
  stage: CapitalStage;
  label: string;
  pct: number;
  autoUnlocked: boolean;
  overrideUnlocked: boolean | undefined;
  overrideRow: {
    is_unlocked: boolean;
    overridden_by: string;
    overridden_at: string;
    notes: string | null;
  } | null;
};

type Props = {
  founderId: string;
  companyId: string;
  adminName: string;
  stages: StageRow[];
};

export function AdminLearningStageOverridePanel({ founderId, companyId, adminName, stages }: Props) {
  const t = useTranslations("adminCmp");
  // Local override state: undefined = no override (use auto), true/false = force
  const [localOverrides, setLocalOverrides] = useState<Partial<Record<CapitalStage, boolean | undefined>>>(
    Object.fromEntries(stages.map((s) => [s.stage, s.overrideUnlocked])),
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (stage: CapitalStage, value: boolean | undefined) => {
    setLocalOverrides((prev) => ({ ...prev, [stage]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      await fetch("/api/admin/learning/stage-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderId, companyId, adminName, overrides: localOverrides }),
      }).catch(() => {});
      setSaved(true);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("stage_access_override")}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Bypass the {CAPITAL_STAGE_UNLOCK_THRESHOLD}% threshold for this founder. All overrides are audit-logged.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {stages.map((row) => {
          const current = localOverrides[row.stage];
          // Effective unlock: if override exists use it, else use auto
          const effectiveUnlock = current !== undefined ? current : row.autoUnlocked;
          return (
            <div key={row.stage} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${row.pct}%`,
                          background: row.pct >= CAPITAL_STAGE_UNLOCK_THRESHOLD ? "#3B6D11" : "#2E78F5",
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{row.pct}%</span>
                    {row.autoUnlocked && current === undefined && (
                      <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                        Auto-unlocked
                      </span>
                    )}
                    {!row.autoUnlocked && current === undefined && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                        Auto-locked
                      </span>
                    )}
                  </div>
                </div>
                {/* Override buttons */}
                <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                  <button
                    onClick={() => handleToggle(row.stage, undefined)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      current === undefined ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => handleToggle(row.stage, true)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      current === true ? "bg-indigo-600 text-white" : "text-slate-500"
                    }`}
                  >
                    Force unlock
                  </button>
                  <button
                    onClick={() => handleToggle(row.stage, false)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      current === false ? "bg-red-500 text-white" : "text-slate-500"
                    }`}
                  >
                    Force lock
                  </button>
                </div>
              </div>
              {row.overrideRow && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Last override by {row.overrideRow.overridden_by} on{" "}
                  {new Date(row.overrideRow.overridden_at).toLocaleDateString()}
                  {row.overrideRow.notes ? ` — "${row.overrideRow.notes}"` : ""}
                </p>
              )}
              {current === true && (
                <p className="mt-1.5 text-[10px] font-semibold text-amber-700">
                  ⚠ Force unlock — audit log entry will be created on save
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-6 py-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : saved ? "✓ Saved" : "Save stage settings"}
        </button>
      </div>
    </div>
  );
}
