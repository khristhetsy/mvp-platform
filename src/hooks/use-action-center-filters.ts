"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseActionCenterFilters } from "@/lib/actions/filters";
import type { ActionCenterTab } from "@/lib/actions/types";
import type { ActionCenterFilters } from "@/lib/actions/types";

export function useActionCenterFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseActionCenterFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<ActionCenterFilters>) => {
      const next = new URLSearchParams(searchParams.toString());
      const apply = (key: string, value: string | undefined | null) => {
        if (value === undefined) return;
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      };

      if ("tab" in patch) apply("tab", patch.tab);
      if ("status" in patch) apply("status", patch.status ?? null);
      if ("priority" in patch) apply("priority", patch.priority ?? null);
      if ("category" in patch) apply("category", patch.category ?? null);
      if ("entityType" in patch) apply("entityType", patch.entityType ?? null);
      if ("companyId" in patch) apply("company", patch.companyId ?? null);
      if ("investorId" in patch) apply("investor", patch.investorId ?? null);
      if ("spvId" in patch) apply("spv", patch.spvId ?? null);
      if ("overdue" in patch) apply("overdue", patch.overdue ? "true" : null);
      if ("escalated" in patch) apply("escalated", patch.escalated ? "true" : null);
      if ("q" in patch) apply("q", patch.q ?? null);

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setTab = useCallback(
    (tab: ActionCenterTab) => {
      setFilters({ tab, status: undefined });
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { filters, setFilters, setTab, clearFilters };
}
