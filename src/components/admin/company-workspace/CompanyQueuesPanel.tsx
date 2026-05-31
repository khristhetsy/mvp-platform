import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { QUEUE_TYPE_LABELS, formatQueueAge, formatQueueStatus } from "@/lib/queues/queue-display";
import type { AdminQueueItem, AdminQueueType } from "@/lib/queues/admin-queues";
import { getAdminCompanyWorkspaceHref } from "@/lib/admin/company-workspace-types";

export function CompanyQueuesPanel({
  items,
  companyId,
}: Readonly<{ items: AdminQueueItem[]; companyId: string }>) {
  return (
    <WorkspacePanel title="Queue items" subtitle="Active operational queue entries for this company">
      {items.length === 0 ? (
        <EmptyState
          title="No active queue items"
          description="This company is not currently represented in operational queues."
          actionLabel="View all queues"
          actionHref="/admin/queues"
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={getAdminCompanyWorkspaceHref(companyId)} className="font-medium text-indigo-700 hover:text-indigo-900">
                  {item.title}
                </Link>
                <StatusBadge
                  label={QUEUE_TYPE_LABELS[item.queue_type as AdminQueueType] ?? item.queue_type}
                  status="info"
                />
                <StatusBadge label={formatQueueStatus(item.status)} status="neutral" />
              </div>
              {item.subtitle ? <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p> : null}
              <p className="mt-1 text-xs text-slate-400">
                {item.next_action_label} · {formatQueueAge(item.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Source: admin queues ·{" "}
        <Link href={`/admin/queues?company=${companyId}`} className="font-medium text-indigo-600 hover:text-indigo-800">
          Open queues console
        </Link>
      </p>
    </WorkspacePanel>
  );
}
