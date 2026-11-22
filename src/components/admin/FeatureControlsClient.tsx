"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { FeatureControlsByStage } from "@/components/admin/FeatureControlsByStage";
import { useTranslations } from "next-intl";

export function FeatureControlsClient() {
  const t = useTranslations("adminCmp");
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin_internal")}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <SlidersHorizontal className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Feature controls
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          One page for who sees what, organized the way each role&apos;s menu is. Each row has a feature switch, which
          turns the feature on or off for that role, and an In menu checkbox, which hides the menu item without turning
          the feature off. Existing data, documents, and booking links are preserved. Dashboards, settings, and this page
          can&apos;t be disabled.
        </p>
      </div>

      <FeatureControlsByStage />

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
