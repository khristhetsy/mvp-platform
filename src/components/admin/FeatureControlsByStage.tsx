"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { FEATURE_AUDIENCES, featuresForAudience, type FeatureAudience } from "@/lib/feature-controls";
import { buildCards, emptiedStage, type ControlCard, type ControlRow } from "@/lib/feature-controls/by-stage";

const AUDIENCE_LABELS: Record<FeatureAudience, string> = { founder: "Founders", investor: "Investors", admin: "Admin" };

type HiddenByAudience = { founder: Set<string>; investor: Set<string> };

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${on ? "bg-[#1D9E75]" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function SwitchChip({ row }: { row: ControlRow }) {
  const tone =
    row.kind !== "switch" ? "bg-slate-100 text-slate-500" : row.shared ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${tone}`}>
      {row.switchLabel}
      {row.shared ? " (shared)" : ""}
    </span>
  );
}

export function FeatureControlsByStage() {
  const [audience, setAudience] = useState<FeatureAudience>("founder");
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<HiddenByAudience>({ founder: new Set(), investor: new Set() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [flags, founder, investor] = await Promise.all([
          fetch("/api/admin/feature-controls").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/founder-stage-menu").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/admin/investor-stage-menu").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!active) return;
        setMatrix(flags?.matrix ?? {});
        setHidden({
          founder: new Set<string>(founder?.hidden ?? []),
          investor: new Set<string>(investor?.hidden ?? []),
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const cardsByAudience = useMemo(
    () => ({ founder: buildCards("founder"), investor: buildCards("investor"), admin: buildCards("admin") }),
    [],
  );
  const cards = cardsByAudience[audience];

  const isOn = useCallback((a: FeatureAudience, key: string) => matrix[`${a}:${key}`] !== false, [matrix]);
  const toggleSwitch = (key: string) => {
    setMsg(null);
    setMatrix((p) => ({ ...p, [`${audience}:${key}`]: !(p[`${audience}:${key}`] !== false) }));
  };
  const isHidden = (href: string | null) =>
    Boolean(href && audience !== "admin" && hidden[audience].has(href));
  const toggleMenu = (href: string) => {
    if (audience === "admin") return;
    setMsg(null);
    setHidden((prev) => {
      const next = new Set(prev[audience]);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return { ...prev, [audience]: next };
    });
  };

  const keys = featuresForAudience(audience);
  const onCount = keys.filter((k) => isOn(audience, k)).length;

  const cardShown = (card: ControlCard) =>
    card.rows.filter((r) => r.menu && !isHidden(r.href) && (!r.switchKey || isOn(audience, r.switchKey))).length;
  const menuRows = (card: ControlCard) => card.rows.filter((r) => r.menu).length;

  const save = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      for (const a of ["founder", "investor"] as const) {
        const emptied = emptiedStage(cardsByAudience[a], hidden[a]);
        if (emptied) {
          setMsg(`${AUDIENCE_LABELS[a]}: "${emptied}" must keep at least one menu item visible.`);
          return;
        }
      }
      const updates = FEATURE_AUDIENCES.flatMap((a) =>
        featuresForAudience(a).map((feature) => ({ audience: a, feature, enabled: isOn(a, feature) })),
      );
      const requests: Array<[string, unknown]> = [
        ["/api/admin/feature-controls", { updates }],
        ["/api/admin/founder-stage-menu", { hidden: [...hidden.founder] }],
        ["/api/admin/investor-stage-menu", { hidden: [...hidden.investor] }],
      ];
      for (const [url, body] of requests) {
        const res = await fetch(url, {
          method: url.endsWith("feature-controls") ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setMsg(j.error ?? "Save failed.");
          return;
        }
      }
      setMsg("Saved. Changes take effect on the user's next page load.");
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [cardsByAudience, hidden, isOn]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-3">
      {msg ? (
        <p className={`rounded-lg border px-3 py-2 text-sm ${msg.startsWith("Saved") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{msg}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FEATURE_AUDIENCES.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setAudience(a)}
            className={`rounded-full border px-3.5 py-1 text-sm ${
              a === audience ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {AUDIENCE_LABELS[a]}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {onCount} of {keys.length} switches on for {AUDIENCE_LABELS[audience]}
        </span>
      </div>

      {cards.map((card) => (
        <div key={card.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-indigo-700">{card.title}</span>
            <span className="text-xs text-slate-500">
              {audience === "admin" || menuRows(card) === 0
                ? `${card.rows.length} ${card.rows.length === 1 ? "item" : "items"}`
                : `${cardShown(card)} / ${menuRows(card)} shown`}
            </span>
          </div>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="flex-1">{audience === "admin" ? "Feature switch" : "Menu item"}</span>
            <span className="hidden w-56 sm:block">{audience === "admin" ? "Pages governed" : "Page"}</span>
            {audience !== "admin" ? <span className="w-60">Feature switch</span> : <span className="w-16 text-center">Access</span>}
            {audience !== "admin" ? <span className="w-16 text-center">In menu</span> : null}
          </div>
          {card.rows.map((row) => {
            const on = row.switchKey ? isOn(audience, row.switchKey) : true;
            const dim = !on || isHidden(row.href);
            return (
              <div key={row.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-sm last:border-0">
                <span className={`flex-1 ${dim ? "text-slate-400" : "text-slate-900"}`}>{row.label}</span>
                <span className="hidden w-56 truncate font-mono text-[11px] text-slate-400 sm:block">
                  {audience === "admin"
                    ? row.kind === "switch" ? `${row.pages} ${row.pages === 1 ? "page" : "pages"}` : "cannot be switched off"
                    : row.href ?? "not in the menu"}
                </span>
                {audience !== "admin" ? (
                  <span className="flex w-60 items-center gap-2">
                    {row.kind === "switch" && row.switchKey ? (
                      <Switch on={on} label={`${row.switchLabel} for ${AUDIENCE_LABELS[audience]}`} onClick={() => toggleSwitch(row.switchKey!)} />
                    ) : (
                      <span className="inline-block w-9 flex-none text-center text-slate-300">—</span>
                    )}
                    <SwitchChip row={row} />
                  </span>
                ) : (
                  <span className="flex w-16 justify-center">
                    {row.kind === "switch" && row.switchKey ? (
                      <Switch on={on} label={`${row.label} for Admin`} onClick={() => toggleSwitch(row.switchKey!)} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </span>
                )}
                {audience !== "admin" ? (
                  <span className="flex w-16 justify-center">
                    {row.menu && row.href ? (
                      <input
                        type="checkbox"
                        aria-label={`${row.label} shown in menu`}
                        checked={!isHidden(row.href)}
                        onChange={() => toggleMenu(row.href!)}
                        className="h-4 w-4 accent-[#1D9E75]"
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
      </button>
      <p className="max-w-3xl text-xs text-slate-500">
        &quot;Shared&quot; means the switch also governs other items on this page, so one switch hides several at once. &quot;none&quot; means no
        switch exists, so In menu is the only control. A hidden item leaves the menu but the page still opens for anyone with the link.
      </p>
    </div>
  );
}
