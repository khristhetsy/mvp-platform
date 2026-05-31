"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildCompanyFilterChips,
  buildComplianceFilterChips,
  buildCrmFilterChips,
  buildInvestorFilterChips,
  buildSpvFilterChips,
  clearDrilldownParams,
  hasDrilldownFilters,
  parseCompanyQueryFilters,
  parseComplianceQueryFilters,
  parseCrmQueryFilters,
  parseInvestorQueryFilters,
  parseSpvQueryFilters,
  type AdminFilterPage,
  type FilterChip,
} from "@/lib/ui/query-filters";

export function useAdminQueryFilters(page: AdminFilterPage) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    switch (page) {
      case "crm":
        return parseCrmQueryFilters(searchParams);
      case "companies":
        return parseCompanyQueryFilters(searchParams);
      case "investors":
        return parseInvestorQueryFilters(searchParams);
      case "spvs":
        return parseSpvQueryFilters(searchParams);
      case "compliance":
        return parseComplianceQueryFilters(searchParams);
    }
  }, [page, searchParams]);

  const chips: FilterChip[] = useMemo(() => {
    switch (page) {
      case "crm":
        return buildCrmFilterChips(parseCrmQueryFilters(searchParams));
      case "companies":
        return buildCompanyFilterChips(parseCompanyQueryFilters(searchParams));
      case "investors":
        return buildInvestorFilterChips(parseInvestorQueryFilters(searchParams));
      case "spvs":
        return buildSpvFilterChips(parseSpvQueryFilters(searchParams));
      case "compliance":
        return buildComplianceFilterChips(parseComplianceQueryFilters(searchParams));
    }
  }, [page, searchParams]);

  const hasActiveFilters = useMemo(() => hasDrilldownFilters(page, searchParams), [page, searchParams]);

  const clearFilters = useCallback(
    (options?: { keepSearch?: boolean }) => {
      const next = clearDrilldownParams(new URLSearchParams(searchParams.toString()), page, options);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [page, pathname, router, searchParams],
  );

  return {
    filters,
    chips,
    hasActiveFilters,
    clearFilters,
  };
}
