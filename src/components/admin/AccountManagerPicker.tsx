"use client";

import { useCallback, useEffect, useState } from "react";

type Staff = { id: string; name: string };

/** Who manages this Premium account. Everyone sees it; admins can change it. */
export function AccountManagerPicker({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [managerId, setManagerId] = useState<string>("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/companies/${companyId}/account-manager`);
    if (!res.ok) return;
    const data = (await res.json()) as { managerId: string | null; staff: Staff[] };
    setManagerId(data.managerId ?? "");
    setStaff(data.staff ?? []);
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the manager on mount
  useEffect(() => { void load(); }, [load]);

  async function save(next: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/account-manager`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: next || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setManagerId(next);
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const name = staff.find((s) => s.id === managerId)?.name ?? "No account manager yet";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold text-slate-900">Account manager</span>
      {canEdit ? (
        <select
          value={managerId}
          disabled={busy}
          onChange={(e) => void save(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">None</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      ) : (
        <span className="text-sm text-slate-700">{name}</span>
      )}
      {msg ? <span className={`text-xs ${msg === "Saved." ? "text-emerald-700" : "text-red-700"}`}>{msg}</span> : null}
    </div>
  );
}
