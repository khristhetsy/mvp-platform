"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import {
  FEATURES,
  FEATURE_GROUPS,
  FEATURE_AUDIENCES,
  featuresForAudience,
  appliesTo,
} from "@/lib/feature-controls";

const AUDIENCE_LABELS: Record<string, string> = { founder: "Founders", investor: "Investors", admin: "Admin" };

export function FeatureControlsClient() {
  const t = useTranslations("adminCmp");
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/feature-controls");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setMatrix(data.matrix ?? {});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const isOn = useCallback((audience: string, feature: string) => matrix[`${audience}:${feature}`] !== false, [matrix]);

  const toggle = (audience: string, feature: string) =>
    setMatrix((p) => ({ ...p, [`${audience}:${feature}`]: !(p[`${audience}:${feature}`] !== false) }));

  const enabledCount = useMemo(
    () => FEATURE_AUDIENCES.reduce((n, a) => n + featuresForAudience(a).filter((f) => isOn(a, f)).length, 0),
    [isOn],
  );
  const totalCount = useMemo(
    () => FEATURE_AUDIENCES.reduce((n, a) => n + featuresForAudience(a).length, 0),
    [],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updates = FEATURE_AUDIENCES.flatMap((audience) =>
        featuresForAudience(audience).map((feature) => ({ audience, feature, enabled: isOn(audience, feature) })),
      );
      const res = await fetch("/api/admin/feature-controls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error();
      setMsg("Saved. Changes take effect on the user's next page load.");
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [isOn]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin_internal")}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <SlidersHorizontal className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Feature controls
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Turn workspace features on or off for each role. Disabling removes the menu item from that role&apos;s
          navigation on their next page load. Existing data, documents, and booking links are preserved. Dashboards,
          settings, and this page can&apos;t be disabled.
        </p>
      </div>

      {msg ? <p className={`rounded-lg border px-3 py-2 text-sm ${msg.startsWith("Saved") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{msg}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">{t("loading")}</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">{enabledCount} of {totalCount} feature toggles enabled across all roles.</p>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
            <div className="flex items-center border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("feature")}</span>
              {FEATURE_AUDIENCES.map((a) => (
                <span key={a} className="w-24 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{AUDIENCE_LABELS[a]}</span>
              ))}
            </div>

            {FEATURE_GROUPS.map((group) => {
              const groupFeatures = FEATURES.filter((f) => f.group === group);
              if (groupFeatures.length === 0) return null;
              return (
                <div key={group}>
                  <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {group}
                  </div>
                  {groupFeatures.map((feature) => (
                    <div key={feature.key} className="flex items-center border-b border-slate-100 px-4 py-2.5 last:border-0">
                      <span className="flex-1 text-sm text-slate-900">{feature.label}</span>
                      {FEATURE_AUDIENCES.map((audience) => {
                        if (!appliesTo(audience, feature.key)) {
                          return <div key={audience} className="flex w-24 justify-center text-sm text-slate-300">—</div>;
                        }
                        const on = isOn(audience, feature.key);
                        return (
                          <div key={audience} className="flex w-24 justify-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              aria-label={`${feature.label} for ${AUDIENCE_LABELS[audience]}`}
                              onClick={() => toggle(audience, feature.key)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-[#1D9E75]" : "bg-slate-300"}`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <button type="button" onClick={() => void save()} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
        <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save controls"}
      </button>

      <LeadAssigneesCard />
    </div>
  );
}

type StaffOption = { id: string; name: string };

/** Which members are eligible to appear in a contact's "Assigned to" picker.
 *  Empty selection = no restriction (all staff eligible). */
function LeadAssigneesCard() {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/lead-assignees");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setStaff((data.staff ?? []) as StaffOption[]);
        setSelected(new Set((data.eligibleIds ?? []) as string[]));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/lead-assignees", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eligibleIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      setMsg("Saved. Applies on the next contact page load.");
      setTimeout(() => setMsg(null), 4000);
    } catch { setMsg("Save failed."); } finally { setSaving(false); }
  };

  const matches = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const restricted = selected.size > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Lead-assignable members</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose who can appear in a contact&apos;s &ldquo;Assigned to&rdquo; picker. {restricted
            ? `${selected.size} member${selected.size === 1 ? "" : "s"} selected — only these appear.`
            : "None selected — every staff member is eligible."}
        </p>
      </div>

      {loading ? (
        <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No members.</p>
            ) : matches.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                <span className="text-slate-900">{s.name}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save members"}
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:text-slate-700">Clear (allow all)</button>
            )}
            {msg && <span className={`text-sm ${msg.startsWith("Saved") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
