import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Thin wrapper over the canonical EmptyState, preserving the icon-driven
 * signature its existing callers use.
 */
export function PlatformEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: Readonly<{
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}>) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
      action={action}
    />
  );
}
