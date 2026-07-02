"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { CapitalStage } from "@/lib/learning/capital-stages";
import { CAPITAL_STAGE_META } from "@/lib/learning/capital-stages";

type LessonItem = {
  key: string;
  moduleSlug: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  stage: CapitalStage;
  durationMinutes: number;
  done: boolean;
  assigned: boolean;
};

type Props = {
  founderId: string;
  companyId: string;
  adminName: string;
  lessons: LessonItem[];
};

const STAGE_ORDER: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

export function AdminLessonAssignmentPanel({ founderId, companyId, adminName, lessons }: Props) {
  const t = useTranslations("adminCmp");
  const [assignedKeys, setAssignedKeys] = useState<Set<string>>(
    new Set(lessons.filter((l) => l.assigned).map((l) => l.key)),
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<CapitalStage | "all">("all");

  const toggleLesson = (key: string) => {
    setAssignedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      const toAssign = lessons
        .filter((l) => assignedKeys.has(l.key) && !l.assigned)
        .map((l) => ({
          moduleSlug: l.moduleSlug,
          lessonId: l.lessonId,
          lessonTitle: l.lessonTitle,
        }));
      const toRemove = lessons
        .filter((l) => !assignedKeys.has(l.key) && l.assigned)
        .map((l) => ({ moduleSlug: l.moduleSlug, lessonId: l.lessonId }));

      await fetch("/api/admin/learning/lesson-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderId, companyId, adminName, toAssign, toRemove }),
      }).catch(() => {});
      setSaved(true);
    });
  };

  const filteredLessons =
    filter === "all" ? lessons : lessons.filter((l) => l.stage === filter);

  const assignedCount = assignedKeys.size;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t("assign_lessons")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {assignedCount} lesson{assignedCount !== 1 ? "s" : ""} assigned — appear at top of founder&apos;s plan
            </p>
          </div>
        </div>
        {/* Stage filter */}
        <div className="mt-3 flex gap-1 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
              filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            All
          </button>
          {STAGE_ORDER.map((s) => {
            const meta = CAPITAL_STAGE_META[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition`}
                style={
                  filter === s
                    ? { background: meta.color, color: "#fff" }
                    : { background: "#F1F5F9", color: "#475569" }
                }
              >
                {meta.icon} {meta.subtitle}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {filteredLessons.map((lesson) => {
          const isAssigned = assignedKeys.has(lesson.key);
          const stageMeta = CAPITAL_STAGE_META[lesson.stage];
          return (
            <button
              key={lesson.key}
              onClick={() => !lesson.done && toggleLesson(lesson.key)}
              disabled={lesson.done}
              className={`flex w-full items-center gap-3 px-6 py-3.5 text-left transition ${
                lesson.done ? "cursor-default opacity-50" : "hover:bg-slate-50"
              } ${isAssigned && !lesson.done ? "bg-indigo-50/40" : ""}`}
            >
              {/* Checkbox */}
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  lesson.done
                    ? "border-green-300 bg-green-50"
                    : isAssigned
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-slate-300 bg-white"
                }`}
              >
                {lesson.done ? (
                  <span className="text-[8px] text-green-600">✓</span>
                ) : isAssigned ? (
                  <span className="text-[8px] text-white">✓</span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-900">{lesson.lessonTitle}</p>
                <p className="text-[10px] text-slate-400">
                  {lesson.moduleTitle} · {lesson.durationMinutes} min
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: stageMeta.bgColor, color: stageMeta.color }}
                >
                  {stageMeta.icon}
                </span>
                {lesson.done && (
                  <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                    Done
                  </span>
                )}
                {isAssigned && !lesson.done && (
                  <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
                    Assigned
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {filteredLessons.length === 0 && (
          <p className="px-6 py-4 text-sm text-slate-400">{t("no_lessons_for_this_filter")}</p>
        )}
      </div>
      <div className="border-t border-slate-100 px-6 py-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : saved ? "✓ Saved" : "Save lesson assignments"}
        </button>
      </div>
    </div>
  );
}
