import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getAdminSpvWorkspaceHref } from "@/lib/admin/spv-workspace-types";
import { QUEUE_TYPE_LABELS, formatQueueAge, formatQueueStatus } from "@/lib/queues/queue-display";
import type { AdminQueueItem, AdminQueueType } from "@/lib/queues/admin-queues";

export function SpvQueuesPanel({
  items,
  spvId,
  companyId,
}: Readonly<{ items: AdminQueueItem[]; spvId: string; companyId: string }>) {
  return (
    <WorkspacePanel title="Queue items" subtitle="Active operational queue entries for this SPV">
      {items.length === 0 ? (
        <EmptyState
          title="No active queue items"
          description="This SPV is not currently represented in operational queues."
          actionLabel="View all queues"
          actionHref="/admin/queues"
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={item.href} className="font-medium text-indigo-700 hover:text-indigo-900">
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
        <Link href={`/admin/queues?spv=${spvId}`} className="font-medium text-indigo-600 hover:text-indigo-800">
          Open queues console
        </Link>
        {" · "}
        <Link href={getAdminSpvWorkspaceHref(spvId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Refresh workspace
        </Link>
      </p>
    </WorkspacePanel>
  );
}
