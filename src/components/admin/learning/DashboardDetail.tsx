"use client";

import { useState, type ReactNode } from "react";
import { MetricDetailDrawer, type MetricDetail } from "@/components/ui/MetricDetailDrawer";

type DetailProps = Readonly<{
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  extra: MetricDetail;
  children: ReactNode;
  className?: string;
}>;

/** A list row that opens the metric drawer with the records behind it. */
export function DetailRow({ label, value, unit, detail, extra, children, className }: DetailProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
        {children}
      </button>
      <MetricDetailDrawer open={open} onClose={() => setOpen(false)} label={label} value={value} unit={unit} detail={detail} audience="admin" extra={extra} />
    </>
  );
}

/** A table row that opens the drawer. Links inside the row keep their own click. */
export function DetailTr({ label, value, unit, detail, extra, children, className }: DetailProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={className}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) return;
          setOpen(true);
        }}
      >
        {children}
      </tr>
      {open ? (
        <tr>
          <td className="p-0">
            <MetricDetailDrawer open={open} onClose={() => setOpen(false)} label={label} value={value} unit={unit} detail={detail} audience="admin" extra={extra} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
