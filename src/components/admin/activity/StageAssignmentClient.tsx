"use client";

import { useMemo, useState } from "react";
import type { StageAssignment, StageAssignmentBoard, StaffMember } from "@/lib/activity/assignments";
import {
  type ActivityAudience,
  type ActivityStage,
  activityStageLabel,
  audienceOfStage,
  classesForStage,
  isFounderStage,
} from "@/lib/activity/stages";

type TriState = "on" | "off" | "some";

const AVATAR_COLORS = ["#4F46E5", "#0891B2", "#EA580C", "#059669", "#7C3AED", "#BE185D"];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function stagePillClass(stage: ActivityStage): string {
  if (!isFounderStage(stage)) return "bg-violet-50 text-violet-800";
  return {
    initialize: "bg-indigo-50 text-indigo-800",
    qualify: "bg-cyan-50 text-cyan-800",
    deploy: "bg-orange-50 text-orange-800",
    optimize: "bg-emerald-50 text-emerald-800",
  }[stage];
}

/** Indeterminate is the point: it says coverage is uneven without reading the grid. */
function Checkbox({
  state,
  onClick,
  label,
}: Readonly<{ state: TriState; onClick: () => void; label: string }>) {
  const on = state !== "off";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-checked={state === "on" ? "true" : state === "some" ? "mixed" : "false"}
      role="checkbox"
      className={`inline-flex h-[15px] w-[15px] items-center justify-center rounded border text-[10px] font-bold leading-none ${
        on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"
      }`}
    >
      {state === "on" ? "✓" : state === "some" ? "–" : ""}
    </button>
  );
}

function Avatar({ member, dim = false }: Readonly<{ member: StaffMember; dim?: boolean }>) {
  return (
    <span
      title={member.name}
      className="-ml-[7px] flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border-2 border-white text-[9.5px] font-bold text-white first:ml-0"
      style={{ background: dim ? "#94A3B8" : avatarColor(member.id) }}
    >
      {member.initials}
    </span>
  );
}

export function StageAssignmentClient({
  initial,
  canEdit,
}: Readonly<{ initial: StageAssignmentBoard; canEdit: boolean }>) {
  const [board, setBoard] = useState(initial);
  const [audience, setAudience] = useState<ActivityAudience | "both">("both");
  const [selected, setSelected] = useState<Set<ActivityStage>>(new Set());
  const [expanded, setExpanded] = useState<ActivityStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      board.stages.filter((s) => (audience === "both" ? true : audienceOfStage(s.stage) === audience)),
    [board.stages, audience],
  );

  const staffById = useMemo(
    () => new Map(board.staff.map((m) => [m.id, m])),
    [board.staff],
  );

  async function send(body: unknown, confirmText?: string) {
    if (!canEdit) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/activity/assignments", {
        method: body && (body as { action?: string }).action ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | (StageAssignmentBoard & { error?: string; clearedLeads?: ActivityStage[] })
        | null;
      if (!res.ok || !json) {
        setNotice(json?.error ?? "Unable to save.");
        return;
      }
      setBoard({ staff: json.staff, stages: json.stages });
      if (json.clearedLeads?.length) {
        setNotice(
          `Lead cleared on ${json.clearedLeads.map(activityStageLabel).join(", ")} — pick a new lead before these go unattended.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- the three select-alls -------------------------------------------
  // Each answers a different question, so each has its own write shape.

  /** Top-left: every VISIBLE stage. Never rows hidden behind the filter. */
  const allState: TriState =
    selected.size === 0 ? "off" : selected.size === visible.length ? "on" : "some";

  function toggleAll() {
    setSelected((s) => (s.size === visible.length ? new Set() : new Set(visible.map((v) => v.stage))));
  }

  /** Column: one person across every visible stage of an audience. */
  function columnState(member: StaffMember): TriState {
    const on = visible.filter((s) => s.userIds.includes(member.id)).length;
    if (on === 0) return "off";
    return on === visible.length ? "on" : "some";
  }

  async function toggleColumn(member: StaffMember) {
    const state = columnState(member);
    const assigning = state !== "on";
    const leadsHeld = visible
      .filter((s) => s.leadUserId === member.id)
      .map((s) => activityStageLabel(s.stage));

    // Un-ticking is the asymmetric one: assigning a watcher is cheap, removing
    // one can strip a lead and leave a stage where everyone assumes somebody
    // else has it. So the removal confirms and names the stages.
    const confirmText =
      !assigning && leadsHeld.length
        ? `${member.name} leads ${leadsHeld.join(", ")}. Removing them from every stage clears those leads. Continue?`
        : undefined;

    const audiences: ActivityAudience[] =
      audience === "both" ? ["founder", "investor"] : [audience];

    for (const a of audiences) {
      // Sequential on purpose: two writes at most, and the second must see the
      // board the first produced.
      await send({ action: "column", audience: a, userId: member.id, assigned: assigning }, confirmText);
    }
  }

  /** Row selection: bulk over the chosen stages. */
  function toggleRow(stage: ActivityStage) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  async function bulkAssign(userId: string, add: boolean) {
    await send({
      action: "bulk",
      stages: [...selected],
      ...(add ? { addUserIds: [userId] } : { removeUserIds: [userId] }),
    });
    setSelected(new Set());
  }

  async function bulkEscalation(minutes: number | null, toUserId: string | null) {
    await send({
      action: "bulk",
      stages: [...selected],
      escalateAfterMinutes: minutes,
      escalateToUserId: toUserId,
    });
    setSelected(new Set());
  }

  const unledCount = visible.filter((s) => !s.leadUserId).length;
  const unassignedCount = visible.filter((s) => s.userIds.length === 0).length;

  return (
    <div className="space-y-4">
      {(unassignedCount > 0 || unledCount > 0) && (
        <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.3px] leading-relaxed text-red-900">
          <span aria-hidden>⚠</span>
          <span>
            {unassignedCount > 0 && (
              <>
                <b>{unassignedCount} stage{unassignedCount === 1 ? " has" : "s have"} nobody assigned</b> —
                events there fall back to every super_admin.{" "}
              </>
            )}
            {unledCount > 0 && (
              <>
                <b>{unledCount} stage{unledCount === 1 ? "" : "s"} with no lead.</b> Without a named
                lead, the alert has no owner and the escalation clock has nothing to start from.
              </>
            )}
          </span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.3px] text-amber-900">
          {notice}
        </div>
      )}

      {/* ---------- matrix ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Stage assignment</h2>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">
            {visible.length} stages · {board.staff.length} staff
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
            {(["founder", "investor", "both"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAudience(a);
                  setSelected(new Set());
                }}
                className={`border-r border-slate-200 px-3 py-1.5 last:border-r-0 ${
                  audience === a
                    ? "bg-indigo-600 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {a === "founder" ? "Founder" : a === "investor" ? "Investor" : "Both"}
              </button>
            ))}
          </div>
        </div>

        {/* Selection bar — the Odoo pattern already used on Contacts. */}
        {selected.size > 0 && (
          <div className="m-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12.3px] text-indigo-900">
            <Checkbox state="some" onClick={() => setSelected(new Set())} label="Clear selection" />
            <span>
              <b>
                {selected.size} stage{selected.size === 1 ? "" : "s"} selected
              </b>{" "}
              · {[...selected].map(activityStageLabel).join(", ")}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set(visible.map((v) => v.stage)))}
              className="text-indigo-600 underline"
            >
              Select all {visible.length}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-indigo-600 underline">
              Clear
            </button>
            <span className="flex-1" />
            {canEdit && (
              <>
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void bulkAssign(e.target.value, true);
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px]"
                >
                  <option value="">Assign staff…</option>
                  {board.staff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void bulkAssign(e.target.value, false);
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px]"
                >
                  <option value="">Remove staff…</option>
                  {board.staff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select
                  disabled={busy}
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) void bulkEscalation(v === "never" ? null : Number(v), null);
                    e.target.value = "";
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px]"
                >
                  <option value="">Set escalation…</option>
                  <option value="0">Immediately</option>
                  <option value="60">After 1 hour</option>
                  <option value="240">After 4 hours</option>
                  <option value="1440">After 24 hours</option>
                  <option value="never">Never escalate</option>
                </select>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full border-collapse text-[12.3px]">
            <thead>
              <tr>
                <th className="w-7 border-b border-slate-200 pb-2">
                  <Checkbox state={allState} onClick={toggleAll} label="Select all stages" />
                </th>
                <th className="w-[32%] border-b border-slate-200 pb-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  Stage
                </th>
                {board.staff.map((member) => (
                  <th key={member.id} className="border-b border-slate-200 pb-2">
                    <div className="flex flex-col items-center gap-[3px]">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                        {member.initials}
                      </span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {member.name.split(" ")[0]}
                      </span>
                      <Checkbox
                        state={columnState(member)}
                        onClick={() => void toggleColumn(member)}
                        label={`Assign ${member.name} to every stage`}
                      />
                      <span className="text-[8.5px] font-bold tracking-wide text-slate-300">ALL</span>
                    </div>
                  </th>
                ))}
                <th className="w-[17%] border-b border-slate-200 pb-2 text-center text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  Escalates to
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const isSelected = selected.has(row.stage);
                const escalateTo = row.escalateToUserId
                  ? (staffById.get(row.escalateToUserId)?.name ?? "—")
                  : "—";
                return (
                  <tr key={row.stage} className={isSelected ? "bg-indigo-50/60" : undefined}>
                    <td className="border-b border-slate-100 px-0 py-2 text-center">
                      <Checkbox
                        state={isSelected ? "on" : "off"}
                        onClick={() => toggleRow(row.stage)}
                        label={`Select ${activityStageLabel(row.stage)}`}
                      />
                    </td>
                    <td className="border-b border-slate-100 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${stagePillClass(row.stage)}`}
                      >
                        {activityStageLabel(row.stage)}
                      </span>
                      {row.userIds.length === 0 && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-red-700">
                          Unassigned
                        </span>
                      )}
                      {row.userIds.length > 0 && !row.leadUserId && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
                          No lead
                        </span>
                      )}
                    </td>
                    {board.staff.map((member) => {
                      const on = row.userIds.includes(member.id);
                      const lead = row.leadUserId === member.id;
                      return (
                        <td key={member.id} className="border-b border-slate-100 py-2 text-center">
                          <button
                            type="button"
                            disabled={!canEdit || busy}
                            title={
                              lead
                                ? `${member.name} leads this stage`
                                : on
                                  ? `${member.name} is notified — click to make lead`
                                  : `Add ${member.name}`
                            }
                            onClick={() => {
                              // Click cycles off → watcher → lead → off. The lead
                              // is a promotion of an existing assignee, never a
                              // separate control, so a lead can never be someone
                              // who is not on the stage.
                              const next = !on
                                ? { userIds: [...row.userIds, member.id], leadUserId: row.leadUserId }
                                : lead
                                  ? {
                                      userIds: row.userIds.filter((id) => id !== member.id),
                                      leadUserId: null,
                                    }
                                  : { userIds: row.userIds, leadUserId: member.id };
                              void send({
                                stage: row.stage,
                                userIds: next.userIds,
                                leadUserId: next.leadUserId,
                              });
                            }}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${
                              lead
                                ? "bg-indigo-600 text-white"
                                : on
                                  ? "bg-indigo-50 text-indigo-600"
                                  : "border border-dashed border-slate-200 bg-slate-50 text-transparent"
                            }`}
                          >
                            {lead ? "★" : on ? "✓" : "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-slate-100 py-2 text-center text-[11.5px] text-slate-600">
                      {row.escalateAfterMinutes === null
                        ? "never"
                        : `${escalateTo} · ${
                            row.escalateAfterMinutes === 0
                              ? "immediate"
                              : row.escalateAfterMinutes >= 60
                                ? `${Math.round(row.escalateAfterMinutes / 60)}h`
                                : `${row.escalateAfterMinutes}m`
                          }`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded bg-indigo-600 text-[9px] font-bold text-white">
                ★
              </span>
              Lead — named in the alert, escalation starts from them
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded bg-indigo-50 text-[9px] font-bold text-indigo-600">
                ✓
              </span>
              Also notified
            </span>
            <span className="flex items-center gap-1.5">
              <Checkbox state="some" onClick={() => undefined} label="Partly filled" />
              Some, not all
            </span>
          </div>
        </div>
      </div>

      {/* ---------- per-stage detail ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Per stage</h2>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setExpanded(null)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Collapse all
          </button>
        </div>

        {visible.map((row) => (
          <StageDetail
            key={row.stage}
            row={row}
            staff={board.staff}
            open={expanded === row.stage}
            canEdit={canEdit}
            busy={busy}
            onToggle={() => setExpanded((e) => (e === row.stage ? null : row.stage))}
            onSave={(body) => void send(body)}
          />
        ))}
      </div>
    </div>
  );
}

function StageDetail({
  row,
  staff,
  open,
  canEdit,
  busy,
  onToggle,
  onSave,
}: Readonly<{
  row: StageAssignment;
  staff: StaffMember[];
  open: boolean;
  canEdit: boolean;
  busy: boolean;
  onToggle: () => void;
  onSave: (body: unknown) => void;
}>) {
  const classes = classesForStage(row.stage);
  const overrides = classes.filter((c) => c.overrides?.length);
  const assigned = row.userIds
    .map((id) => staff.find((m) => m.id === id))
    .filter(Boolean) as StaffMember[];
  const lead = row.leadUserId ? staff.find((m) => m.id === row.leadUserId) : null;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 ${
          row.userIds.length === 0 ? "bg-red-50" : ""
        }`}
      >
        <span
          className={`inline-block h-2 w-2 shrink-0 border-b-2 border-r-2 border-slate-400 transition-transform ${
            open ? "rotate-45" : "-rotate-45"
          }`}
        />
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${stagePillClass(row.stage)}`}
        >
          {activityStageLabel(row.stage)}
        </span>
        <span className="flex-1 truncate text-[11.5px] text-slate-500">
          {classes.length} alert class{classes.length === 1 ? "" : "es"}
        </span>
        <span className="flex items-center">
          {assigned.map((m) => (
            <Avatar key={m.id} member={m} />
          ))}
          {assigned.length === 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-red-700">
              Nobody
            </span>
          )}
        </span>
        <span className="ml-2 shrink-0 text-[11px] text-slate-500">
          {lead ? `${lead.name.split(" ")[0]} leads` : "no lead"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 py-1 pb-4 pl-9 pr-4">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Who is notified
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {staff.map((member) => {
                const on = row.userIds.includes(member.id);
                const isLead = row.leadUserId === member.id;
                return (
                  <label
                    key={member.id}
                    className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[12.3px] ${
                      on ? "bg-indigo-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!canEdit || busy}
                      onChange={() =>
                        onSave({
                          stage: row.stage,
                          userIds: on
                            ? row.userIds.filter((id) => id !== member.id)
                            : [...row.userIds, member.id],
                          leadUserId: on && isLead ? null : row.leadUserId,
                        })
                      }
                    />
                    <Avatar member={member} />
                    <span className="flex-1">
                      {member.name}
                      <span className="block text-[10.5px] text-slate-500">{member.role}</span>
                    </span>
                    {on && (
                      <button
                        type="button"
                        disabled={!canEdit || busy}
                        onClick={(e) => {
                          e.preventDefault();
                          onSave({
                            stage: row.stage,
                            userIds: row.userIds,
                            leadUserId: isLead ? null : member.id,
                          });
                        }}
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                          isLead ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500"
                        }`}
                      >
                        {isLead ? "Lead" : "Make lead"}
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Escalation
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11.8px] text-slate-600">
                <span>Unopened high or critical after</span>
                <select
                  disabled={!canEdit || busy}
                  value={row.escalateAfterMinutes ?? "never"}
                  onChange={(e) =>
                    onSave({
                      stage: row.stage,
                      userIds: row.userIds,
                      leadUserId: row.leadUserId,
                      escalateAfterMinutes: e.target.value === "never" ? null : Number(e.target.value),
                      escalateToUserId: row.escalateToUserId,
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11.5px]"
                >
                  <option value="0">immediately</option>
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                  <option value="1440">24 hours</option>
                  <option value="never">never</option>
                </select>
                <span>goes to</span>
                <select
                  disabled={!canEdit || busy}
                  value={row.escalateToUserId ?? ""}
                  onChange={(e) =>
                    onSave({
                      stage: row.stage,
                      userIds: row.userIds,
                      leadUserId: row.leadUserId,
                      escalateAfterMinutes: row.escalateAfterMinutes,
                      escalateToUserId: e.target.value || null,
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11.5px]"
                >
                  <option value="">nobody</option>
                  {staff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Leaves this stage
              </p>
              {overrides.length ? (
                <p className="text-[11.8px] leading-relaxed text-slate-600">
                  {overrides.map((c) => (
                    <span key={c.key} className="block">
                      <b>{c.label}</b> → also {c.overrides!.join(", ")}
                    </span>
                  ))}
                  <span className="mt-1 block text-slate-400">
                    Firm risk rather than stage work — these ignore the stage owners.
                  </span>
                </p>
              ) : (
                <p className="text-[11.8px] text-slate-400">
                  Nothing in this stage escalates past its owners.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
