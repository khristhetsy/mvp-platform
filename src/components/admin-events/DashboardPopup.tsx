"use client";

import { useState } from "react";
import { MetricDetailDrawer, type MetricDetail } from "@/components/ui/MetricDetailDrawer";

/**
 * Wraps any number or row on the Events dashboard so a click opens the same
 * centred detail popup the metric tiles use: the figure, the records behind it
 * (each one a link) and the on-demand AI explanation.
 */
export function DashboardPopup({
  label,
  value,
  unit,
  detail,
  flag,
  detailPanel,
  className,
  children,
}: Readonly<{
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  detailPanel: MetricDetail;
  className?: string;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "text-left hover:text-[#1A6CE4]"} aria-haspopup="dialog">
        {children}
      </button>
      <MetricDetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        value={value}
        unit={unit}
        detail={detail}
        flag={flag}
        audience="admin"
        extra={detailPanel}
      />
    </>
  );
}
