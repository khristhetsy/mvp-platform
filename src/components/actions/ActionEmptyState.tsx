import { EmptyState } from "@/components/ui/EmptyState";

/** Thin wrapper over the canonical EmptyState for filtered action lists. */
export function ActionEmptyState({ message }: Readonly<{ message?: string }>) {
  return (
    <EmptyState
      title="No actions match your filters"
      description={message ?? "Try another tab or clear filters to see more workflow items."}
    />
  );
}
