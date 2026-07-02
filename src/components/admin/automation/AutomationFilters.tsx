"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTOMATION_TRIGGER_TYPES } from "@/lib/automation/types";

export function AutomationFilters() {
  const t = useTranslations("adminCmp");
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    params.delete("offset");
    router.push(`/admin/automation?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-3">
      <label className="text-xs">
        <span className="font-medium text-slate-600">{t("status")}</span>
        <select
          className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value || null)}
        >
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
      </label>
      <label className="text-xs">
        <span className="font-medium text-slate-600">{t("trigger")}</span>
        <select
          className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          value={searchParams.get("trigger") ?? ""}
          onChange={(e) => update("trigger", e.target.value || null)}
        >
          <option value="">All</option>
          {AUTOMATION_TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="font-medium text-slate-600">{t("dry_run")}</span>
        <select
          className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          value={searchParams.get("dryRun") ?? ""}
          onChange={(e) => update("dryRun", e.target.value || null)}
        >
          <option value="">All</option>
          <option value="true">Dry only</option>
          <option value="false">Live only</option>
        </select>
      </label>
      <label className="text-xs">
        <span className="font-medium text-slate-600">{t("entity")}</span>
        <select
          className="mt-1 block rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          value={searchParams.get("entityType") ?? ""}
          onChange={(e) => update("entityType", e.target.value || null)}
        >
          <option value="">All</option>
          <option value="company">Company</option>
          <option value="investor">Investor</option>
          <option value="spv">SPV</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={searchParams.get("failures") === "true"}
          onChange={(e) => update("failures", e.target.checked ? "true" : null)}
        />
        Failures only
      </label>
      <label className="text-xs">
        <span className="font-medium text-slate-600">{t("search")}</span>
        <input
          className="mt-1 block w-40 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          placeholder={t("trigger_entity")}
          defaultValue={searchParams.get("q") ?? ""}
          onBlur={(e) => update("q", e.target.value.trim() || null)}
        />
      </label>
    </div>
  );
}
