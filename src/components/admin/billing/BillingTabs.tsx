import Link from "next/link";

/** Tabs across Admin, Billing: customers (Lemon Squeezy) and wire payments (Premium). */
export function BillingTabs({ active, overdueCount = 0 }: Readonly<{ active: "customers" | "wire"; overdueCount?: number }>) {
  const tab = (key: "customers" | "wire", href: string, label: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium ${active === key ? "border-[#1A6CE4] text-[#0A1A40]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="mb-5 flex gap-2 border-b border-slate-200" aria-label="Billing sections">
      {tab("customers", "/admin/billing", "Customers")}
      {tab(
        "wire",
        "/admin/billing/wire",
        <>
          Wire payments
          {overdueCount > 0 ? <span className="ml-1.5 rounded-md bg-[#FCEBEB] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#A32D2D]">{overdueCount} overdue</span> : null}
        </>,
      )}
    </nav>
  );
}
