import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { FounderRemediationTaskList } from "@/components/FounderRemediationTaskList";
import type { RemediationTaskRecord } from "@/lib/remediation/types";

export function FounderRemediationActionPlan({
  tasks,
  summary,
  learningLinks = {},
  compact = false,
  title = "Readiness action plan",
}: Readonly<{
  tasks: RemediationTaskRecord[];
  summary: {
    total: number;
    active: number;
    completed: number;
  };
  learningLinks?: Record<string, { slug: string; title: string }>;
  compact?: boolean;
  title?: string;
}>) {
  if (compact && summary.active === 0) {
    return null;
  }

  return (
    <WorkspacePanel
      title={title}
      subtitle={
        summary.active > 0
          ? `${summary.active} active remediation tasks · ${summary.completed} completed`
          : "All remediation tasks addressed"
      }
      action={
        compact ? (
          <Link href="/founder/readiness" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
            View all
          </Link>
        ) : null
      }
    >
      {summary.active > 0 ? (
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Improve your readiness by closing gaps in your profile, documents, and diligence posture. Tasks refresh
          automatically as your onboarding and readiness data changes.
        </p>
      ) : null}
      <FounderRemediationTaskList tasks={tasks} learningLinks={learningLinks} compact={compact} />
    </WorkspacePanel>
  );
}
