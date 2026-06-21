"use client";

import { DD_COLORS } from "@/lib/diligence/types";

type Variant =
  | "high" | "medium" | "low"
  | "unverified" | "requested" | "submitted" | "verified" | "discrepancy"
  | "open" | "mitigating" | "resolved"
  | "draft" | "sent_to_founder" | "responding" | "admin_review" | "consent_requested" | "consented_locked" | "released";

const STYLES: Record<string, { bg: string; fg: string; label?: string }> = {
  high: { bg: "#fbeae8", fg: DD_COLORS.high, label: "High" },
  medium: { bg: "#fdf1e1", fg: DD_COLORS.med, label: "Medium" },
  low: { bg: "#eef1f4", fg: DD_COLORS.low, label: "Low" },
  unverified: { bg: "#eef1f4", fg: DD_COLORS.low, label: "Unverified" },
  requested: { bg: "#eaf1f9", fg: DD_COLORS.brand, label: "Requested" },
  submitted: { bg: "#fdf1e1", fg: DD_COLORS.med, label: "Submitted" },
  verified: { bg: "#e6f4ec", fg: DD_COLORS.verified, label: "Verified" },
  discrepancy: { bg: "#fbeae8", fg: DD_COLORS.high, label: "Discrepancy" },
  open: { bg: "#eef1f4", fg: DD_COLORS.low, label: "Open" },
  mitigating: { bg: "#fdf1e1", fg: DD_COLORS.med, label: "Mitigating" },
  resolved: { bg: "#e6f4ec", fg: DD_COLORS.verified, label: "Resolved" },
  draft: { bg: "#eef1f4", fg: DD_COLORS.low, label: "Draft" },
  sent_to_founder: { bg: "#eaf1f9", fg: DD_COLORS.brand, label: "Sent to founder" },
  responding: { bg: "#eaf1f9", fg: DD_COLORS.brand, label: "Responding" },
  admin_review: { bg: "#fdf1e1", fg: DD_COLORS.med, label: "Admin review" },
  consent_requested: { bg: "#fdf1e1", fg: DD_COLORS.med, label: "Consent requested" },
  consented_locked: { bg: "#e6f4ec", fg: DD_COLORS.verified, label: "Consented & locked" },
  released: { bg: "#e6f4ec", fg: DD_COLORS.verified, label: "Released" },
};

export function StateChip({ variant, children }: { variant: Variant; children?: React.ReactNode }) {
  const s = STYLES[variant] ?? { bg: "#eef1f4", fg: DD_COLORS.low };
  return (
    <span style={{ background: s.bg, color: s.fg }} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
      {children ?? s.label ?? variant}
    </span>
  );
}
