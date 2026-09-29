"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_CLASSES,
  type ActivityAudience,
  type ActivityClassKey,
  type ActivityStage,
  activityStageLabel,
  audienceOfStage,
  classesForStage,
  isFounderStage,
  stagesFor,
} from "@/lib/activity/stages";
import {
  activityEventsPatch,
  activityPrefsFrom,
  effectiveClassPref,
} from "@/lib/activity/preferences";
import type { NotificationPrefs } from "@/lib/notifications/preferences";
import type { StageAssignmentBoard } from "@/lib/activity/assignment-types";

type Channel = "in_app" | "email" | "digest";

function stagePillClass(stage: ActivityStage): string {
  if (!isFounderStage(stage)) return "bg-violet-50 text-violet-800";
  return {
    initialize: "bg-indigo-50 text-indigo-800",
    qualify: "bg-cyan-50 text-cyan-800",
    deploy: "bg-orange-50 text-orange-800",
    optimize: "bg-emerald-50 text-emerald-800",
  }[stage];
}

function Switch({
  on,
  disabled,
  onClick,
  label,
}: Readonly<{ on: boolean; disabled?: boolean; onClick: () => void; label: string }>) {
  if (disabled) {
    // Not merely off — unavailable. A deletion or a gate crossing twelve hours
    // late is not a notification, so these classes cannot be put in a digest at
    // all, and showing an on-able switch would be a control that cannot run.
    return (
      <span
        title="This class never waits for a digest"
        aria-label={`${label} — not available`}
        className="mx-auto block h-[18px] w-8 rounded-full border border-dashed border-slate-200 bg-slate-50"
      />
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative mx-auto block h-[18px] w-8 rounded-full transition-colors ${
        on ? "bg-indigo-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
          on ? "left-[16px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function AccountActivityAlerts({
  assignments,
}: Readonly<{ assignments: StageAssignmentBoard }>) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [audience, setAudience] = useState<ActivityAudience>("founder");
  const [open, setOpen] = useState<Set<ActivityStage>>(new Set(["initialize", "qualify"]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notification-preferences");
      if (!res.ok) throw new Error("load failed");
      setPrefs((await res.json()) as NotificationPrefs);
    } catch {
      setError("Could not load your preferences.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; the setState is inside the async callback
    void load();
  }, [load]);

  const activityPrefs = useMemo(
    () => (prefs ? activityPrefsFrom(prefs) : { classes: {} }),
    [prefs],
  );

  async function save(next: NotificationPrefs) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
      setPrefs((await res.json()) as NotificationPrefs);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not save. Your change was not applied.");
      void load();
    } finally {
      setSaving(false);
    }
  }

  function toggle(classKey: ActivityClassKey, channel: Channel) {
    if (!prefs) return;
    const current = effectiveClassPref(activityPrefs, classKey);
    const next: NotificationPrefs = {
      ...prefs,
      // Writes only our `activity.` keys — every other event key in the jsonb is
      // left exactly as it was, so this screen and the existing one can both
      // edit the same row without trampling each other.
      events: activityEventsPatch(prefs.events, {
        [classKey]: { ...current, [channel]: !current[channel] },
      }),
    };
    setPrefs(next);
    void save(next);
  }

  const stages = stagesFor(audience);
  const classCount = ACTIVITY_CLASSES.filter(
    (c) => audienceOfStage(c.stage) === audience,
  ).length;

  const assignedOf = useMemo(() => {
    const map = new Map<ActivityStage, string[]>();
    for (const s of assignments.stages) {
      map.set(
        s.stage,
        s.userIds
          .map((id) => assignments.staff.find((m) => m.id === id)?.name)
          .filter(Boolean) as string[],
      );
    }
    return map;
  }, [assignments]);

  if (!prefs) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Account activity alerts</h2>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">
            {stages.length} stages · {classCount} classes
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs">
            {(["founder", "investor"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`border-r border-slate-200 px-3 py-1.5 last:border-r-0 ${
                  audience === a
                    ? "bg-indigo-600 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {a === "founder" ? "Founder stages" : "Investor stages"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => (o.size ? new Set() : new Set(stages)))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            {open.size ? "Collapse all" : "Expand all"}
          </button>
          <Link
            href="/admin/activity/assignments"
            className="rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Who gets these
          </Link>
        </div>

        {stages.map((stage) => {
          const classes = classesForStage(stage);
          const isOpen = open.has(stage);
          const people = assignedOf.get(stage) ?? [];
          return (
            <div key={stage} className="border-b border-slate-100 last:border-b-0">
              <button
                type="button"
                onClick={() =>
                  setOpen((o) => {
                    const next = new Set(o);
                    if (next.has(stage)) next.delete(stage);
                    else next.add(stage);
                    return next;
                  })
                }
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 border-b-2 border-r-2 border-slate-400 transition-transform ${
                    isOpen ? "rotate-45" : "-rotate-45"
                  }`}
                />
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${stagePillClass(stage)}`}
                >
                  {activityStageLabel(stage)}
                </span>
                <span className="flex-1 truncate text-[11.5px] text-slate-500">
                  {classes.length} classes
                  {people.length ? ` · ${people.join(", ")}` : " · nobody assigned"}
                </span>
              </button>

              {isOpen && (
                <div className="pb-3 pl-9 pr-4">
                  <div className="grid grid-cols-[1fr_54px_54px_54px_120px] items-center gap-2 border-b border-slate-200 pb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                    <span />
                    <span className="text-center">App</span>
                    <span className="text-center">Mail</span>
                    <span className="text-center">Digest</span>
                    <span className="text-center">Goes to</span>
                  </div>
                  {classes.map((cls) => {
                    const pref = effectiveClassPref(activityPrefs, cls.key);
                    return (
                      <div
                        key={cls.key}
                        className="grid grid-cols-[1fr_54px_54px_54px_120px] items-center gap-2 border-b border-slate-50 py-1.5 text-[12.4px] last:border-b-0"
                      >
                        <div>
                          <p className="text-slate-900">{cls.label}</p>
                          <p className="text-[11px] text-slate-500">{cls.description}</p>
                        </div>
                        <Switch
                          on={pref.in_app}
                          onClick={() => toggle(cls.key, "in_app")}
                          label={`${cls.label} in-app`}
                        />
                        <Switch
                          on={pref.email}
                          onClick={() => toggle(cls.key, "email")}
                          label={`${cls.label} email`}
                        />
                        <Switch
                          on={pref.digest}
                          disabled={!cls.digestable}
                          onClick={() => toggle(cls.key, "digest")}
                          label={`${cls.label} digest`}
                        />
                        <span className="text-center text-[11px] text-slate-600">
                          {cls.overrides?.length ? (
                            <>
                              +{" "}
                              <b className="text-slate-900">
                                {cls.overrides
                                  .map((o) => (o === "ceo" ? "CEO" : "Compliance"))
                                  .join(", ")}
                              </b>
                            </>
                          ) : (
                            "Stage owners"
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-slate-500">
        Dashed digest switches <b className="text-slate-900">bypass digest on purpose</b> — a
        deletion, a gate crossing, or an offering change after money has been committed is
        worthless twelve hours late. Quiet hours, pause-all and the critical override are set on
        your notification preferences and apply here unchanged.
      </p>

      {(saving || saved || error) && (
        <p
          className={`px-1 text-[11.5px] ${error ? "text-red-700" : "text-emerald-700"}`}
          aria-live="polite"
        >
          {error ?? (saving ? "Saving…" : "Saved.")}
        </p>
      )}
    </div>
  );
}
