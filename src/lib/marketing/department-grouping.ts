// Single source of truth for the "group by department" behaviour shared by the
// Marketing Hub Campaigns and Lists pages (previously duplicated verbatim in both
// client components). Pure + framework-free so it can be unit-tested.

export const DEPARTMENTS = ["Sales", "Investor Relations", "Marketing", "Administration", "Events"] as const;
export const UNASSIGNED = "Unassigned";

export const DEPT_META: Record<string, { icon: string; color: string }> = {
  "Sales":              { icon: "ti-shopping-cart",  color: "#0F6E56" },
  "Investor Relations": { icon: "ti-briefcase",      color: "#534AB7" },
  "Marketing":          { icon: "ti-speakerphone",   color: "#BA7517" },
  "Administration":     { icon: "ti-settings",       color: "#5F5E5A" },
  "Events":             { icon: "ti-calendar-event", color: "#199E70" },
  [UNASSIGNED]:         { icon: "ti-folder",         color: "#5F5E5A" },
};

/** A record's effective department: an optimistic override wins, else its saved
 *  value, else Unassigned. */
export function departmentOf(saved: string | null | undefined, override?: string | null): string {
  return (override ?? saved) || UNASSIGNED;
}

/** Group items under DEPARTMENTS + Unassigned (in that fixed order), dropping any
 *  empty group. `deptOf` returns each item's department label. */
export function groupByDepartment<T>(items: T[], deptOf: (item: T) => string): { dept: string; items: T[] }[] {
  return [...DEPARTMENTS, UNASSIGNED]
    .map((dept) => ({ dept, items: items.filter((it) => deptOf(it) === dept) }))
    .filter((g) => g.items.length > 0);
}
