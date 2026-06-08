import type { ReactNode } from "react";

export function DataTable({
  children,
  density = "comfortable",
  className = "",
}: Readonly<{
  children: ReactNode;
  density?: "compact" | "comfortable";
  className?: string;
}>) {
  const densityClass =
    density === "compact" ? "enterprise-table--compact" : "enterprise-table--comfortable";

  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}>
      <table className={`enterprise-table w-full min-w-[640px] border-collapse text-left text-sm ${densityClass}`}>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <thead className="border-b border-slate-200/90 bg-[var(--surface-sunken)]">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableHeaderCell({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return <th scope="col" className={`whitespace-nowrap ${className}`}>{children}</th>;
}

export function DataTableBody({ children }: Readonly<{ children: ReactNode }>) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataTableRow({
  children,
  selected,
}: Readonly<{ children: ReactNode; selected?: boolean }>) {
  return (
    <tr className={selected ? "bg-sky-50/50" : undefined}>{children}</tr>
  );
}

export function DataTableCell({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return <td className={`text-slate-700 ${className}`}>{children}</td>;
}
