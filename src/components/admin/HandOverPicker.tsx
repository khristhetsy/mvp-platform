"use client";

import { useTranslations } from "next-intl";

export type HandOverItem = { key: string; label: string; count: number };
export type HandOverCandidate = { id: string; name: string };

/**
 * Shown in the delete dialogs when the user still owns records that need an
 * owner (IR projects, notes, reports, valuations). The admin picks the
 * teammate who takes them over; the delete sends that id as `reassignTo`.
 */
export function HandOverPicker({
  items,
  candidates,
  value,
  onChange,
}: {
  items: HandOverItem[];
  candidates: HandOverCandidate[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("usersAdmin.manage");
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{t("handOverTitle")}</p>
      <ul className="mt-2 space-y-1">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{i.label}</span>
            <span className="font-semibold text-slate-950">{i.count}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-900">{t("handOverDesc")}</p>
      {candidates.length ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          aria-label={t("handOverPick")}
        >
          <option value="">{t("handOverPick")}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-xs font-medium text-red-700">{t("handOverNone")}</p>
      )}
    </div>
  );
}
