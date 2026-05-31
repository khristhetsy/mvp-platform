/** Enterprise UI tokens — use with Tailwind + CSS variables in globals.css */

export const enterpriseSpacing = {
  pageX: "px-6 lg:px-8",
  pageY: "py-6 lg:py-8",
  panel: "p-5",
  panelCompact: "p-4",
  gapSection: "gap-6",
  gapPanel: "gap-4",
} as const;

export type OperationalStatus =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "pending";

export const statusStyles: Record<
  OperationalStatus,
  { badge: string; dot: string; rail: string }
> = {
  neutral: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
    rail: "bg-slate-200",
  },
  info: {
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
    rail: "bg-sky-500",
  },
  success: {
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
    rail: "bg-emerald-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
    rail: "bg-amber-500",
  },
  danger: {
    badge: "bg-red-50 text-red-800 ring-red-200",
    dot: "bg-red-500",
    rail: "bg-red-500",
  },
  pending: {
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
    dot: "bg-violet-500",
    rail: "bg-violet-400",
  },
};

export const metricAccentBorder: Record<string, string> = {
  indigo: "border-l-slate-800",
  violet: "border-l-violet-600",
  blue: "border-l-sky-600",
  slate: "border-l-slate-400",
};
