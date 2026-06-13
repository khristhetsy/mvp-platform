"use client";

import dynamic from "next/dynamic";

/**
 * Client-side-only loader for TaskWidget.
 * next/dynamic with ssr:false must live in a Client Component —
 * this thin wrapper lets server pages include the widget safely.
 */
const TaskWidget = dynamic(
  () => import("@/components/TaskWidget").then((m) => m.TaskWidget),
  { ssr: false, loading: () => null }
);

export function TaskWidgetLoader() {
  return <TaskWidget />;
}
