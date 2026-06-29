"use client";

import { useState } from "react";
import { PRESENCE_ROOMS } from "@/lib/icfo-events/venue";
import type { EventModerator } from "@/lib/icfo-events/moderators";

type Staff = { id: string; full_name: string | null; email: string | null; roleLabel: string | null };

const ALL = "*";
const ROOM_CHIPS = [...PRESENCE_ROOMS, "All rooms"] as const;

function roomsAfterToggle(current: string[], chip: string): string[] {
  if (chip === "All rooms") return [ALL];
  const base = current.includes(ALL) ? [] : current;
  return base.includes(chip) ? base.filter((r) => r !== chip) : [...base, chip];
}

function isChipActive(rooms: string[], chip: string): boolean {
  if (chip === "All rooms") return rooms.includes(ALL);
  return rooms.includes(chip);
}

export function EventModeratorsManager({
  eventId,
  initialModerators,
  staff,
  canManage,
}: {
  eventId: string;
  initialModerators: EventModerator[];
  staff: Staff[];
  canManage: boolean;
}) {
  const [moderators, setModerators] = useState<EventModerator[]>(initialModerators);
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = new Set(moderators.map((m) => m.userId));
  const available = staff.filter((s) => !assigned.has(s.id));

  async function save(userId: string, rooms: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/moderators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, rooms }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save moderator.");
      setModerators(json.moderators as EventModerator[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save moderator.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/moderators/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not remove moderator.");
      setModerators(json.moderators as EventModerator[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove moderator.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRoom(m: EventModerator, chip: string) {
    if (!canManage) return;
    void save(m.userId, roomsAfterToggle(m.rooms, chip));
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <h2 className="font-semibold text-[var(--navy)]">Event moderators</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Scope a staff member to specific rooms for this event. They can only control their assigned rooms in the live
        Control Center.
      </p>
      {!canManage && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Only super admins can assign moderators. You can view current assignments.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {moderators.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No moderators assigned yet.</p>
        ) : (
          moderators.map((m) => (
            <div key={m.userId} className="rounded-lg border border-[var(--border-subtle)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--navy)]">{m.name}</p>
                  {m.email && <p className="text-xs text-[var(--text-muted)]">{m.email}</p>}
                </div>
                {canManage && (
                  <button
                    onClick={() => remove(m.userId)}
                    disabled={busy}
                    className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ROOM_CHIPS.map((chip) => {
                  const active = isChipActive(m.rooms, chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleRoom(m, chip)}
                      disabled={!canManage || busy}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                        active
                          ? "border-[var(--indigo)] bg-[var(--indigo)] text-white"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <label className="block">
            <span className="text-xs text-[var(--text-muted)]">Add a staff moderator</span>
            <select
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              className="mt-1 block rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
            >
              <option value="">Select staff…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email ?? "Staff"}
                  {s.roleLabel ? ` · ${s.roleLabel}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (!addId) return;
              const id = addId;
              setAddId("");
              void save(id, [ALL]);
            }}
            disabled={busy || !addId}
            className="cap-btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add moderator
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
    </section>
  );
}
