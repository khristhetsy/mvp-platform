"use client";

import { useState } from "react";
import { OperationalMetric } from "@/components/ui/OperationalMetric";
import { MetricDetailDrawer, type MetricDetail } from "@/components/ui/MetricDetailDrawer";

export function MetricCard({
  label,
  value,
  detail,
  accent = "indigo",
  trend,
  sparklineValues,
  lastUpdated,
  statusLabel,
  status,
  urgency,
  href,
  ring,
  flag,
  unit,
  detailPanel,
  audience,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  accent?: "indigo" | "violet" | "blue" | "slate";
  trend?: "up" | "down" | "flat";
  sparklineValues?: number[];
  lastUpdated?: string | null;
  statusLabel?: string;
  status?: "neutral" | "info" | "success" | "warning" | "danger" | "pending";
  urgency?: boolean;
  href?: string;
  ring?: {
    percent: number | null;
    center?: string;
    sublabel?: string;
    color?: string;
    gate?: number | null;
    pending?: boolean;
    title?: string;
  };
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  unit?: string;
  /** Opens a detail drawer on click instead of navigating. Any tile can have one;
   *  the breakdown is what the tile itself has no room for. */
  detailPanel?: MetricDetail;
  /** Who the AI explanation is addressed to. */
  audience?: "admin" | "founder" | "investor";
}>) {
  const [open, setOpen] = useState(false);

  // href navigates; detailPanel opens in place. A tile should not do both — if
  // both are supplied the drawer wins and the link moves inside it.
  const card = (
    <OperationalMetric
      label={label}
      value={value}
      detail={detail}
      accent={accent}
      trend={trend}
      sparklineValues={sparklineValues}
      lastUpdated={lastUpdated}
      statusLabel={statusLabel}
      status={status}
      urgency={urgency}
      ring={ring}
      flag={flag}
      unit={unit}
      href={detailPanel ? undefined : href}
    />
  );

  if (!detailPanel) return card;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left" aria-haspopup="dialog">
        {card}
      </button>
      <MetricDetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        value={value}
        unit={unit}
        detail={detail}
        flag={flag}
        audience={audience}
        extra={{ ...detailPanel, href: detailPanel.href ?? href }}
      />
    </>
  );
}
