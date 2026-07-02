import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslations } from "next-intl";

/** Thin wrapper over the canonical EmptyState for filtered action lists. */
export function ActionEmptyState({ message }: Readonly<{ message?: string }>) {
  const t = useTranslations("sharedCmp");
  return (
    <EmptyState
      title={t("no_actions_match_your_filters")}
      description={message ?? "Try another tab or clear filters to see more workflow items."}
    />
  );
}
