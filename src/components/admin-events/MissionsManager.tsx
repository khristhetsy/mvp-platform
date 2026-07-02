"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { POINT_ACTION_LABELS } from "@/lib/icfo-events/gamification";
import type { PointAction } from "@/lib/icfo-events/gamification";
import type { Mission } from "@/lib/icfo-events/missions";

const ACTIONS = Object.keys(POINT_ACTION_LABELS) as PointAction[];

export function MissionsManager({ initialMissions }: { initialMissions: Mission[] }) {
  const t = useTranslations("adminCmp");
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [bonus, setBonus] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAction(a: string) {
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (actions.length === 0) {
      setError("Pick at least one action.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null, requiredActions: actions, bonusPoints: bonus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't create mission.");
      setMissions((prev) => [...prev, json.mission as Mission]);
      setTitle("");
      setDescription("");
      setActions([]);
      setBonus(25);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create mission.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(m: Mission) {
    const res = await fetch(`/api/admin/events/missions/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    if (res.ok) setMissions((prev) => prev.map((x) => (x.id === m.id ? { ...x, isActive: !x.isActive } : x)));
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--navy)]">{t("missions")}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Bundle actions into a mission; completing all of them in one event earns the bonus.
      </p>

      <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder={t("mission_title_e_g_full_participant")} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder={t("description_optional")} className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm" />
        <div>
          <span className="text-xs text-[var(--text-muted)]">{t("required_actions")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTIONS.map((a) => {
              const on = actions.includes(a);
              return (
                <button type="button" key={a} onClick={() => toggleAction(a)} className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-[var(--indigo)] bg-[var(--indigo-soft)] text-[var(--indigo)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
                  {POINT_ACTION_LABELS[a]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          Bonus points
          <input type="number" min={0} max={1000} value={bonus} onChange={(e) => setBonus(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} className="w-24 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-right text-sm" />
        </label>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !title.trim()} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? "Creating…" : "Add mission"}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {missions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t("no_missions_yet")}</p>
        ) : (
          missions.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3">
              <div>
                <span className="font-medium text-[var(--navy)]">{m.title}</span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">+{m.bonusPoints} pts · {m.requiredActions.length} actions</span>
              </div>
              <button onClick={() => toggleActive(m)} className="text-xs font-medium text-[var(--blue)] hover:underline">
                {m.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
