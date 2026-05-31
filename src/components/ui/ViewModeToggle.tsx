"use client";

import { VIEW_MODE_ICONS, VIEW_MODE_LABELS, type ViewMode } from "@/lib/ui/view-modes";

export function ViewModeToggle({
  value,
  allowedModes,
  onChange,
  disabled,
}: Readonly<{
  value: ViewMode;
  allowedModes: readonly ViewMode[];
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
}>) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
      role="group"
      aria-label="View mode"
    >
      {allowedModes.map((mode) => {
        const Icon = VIEW_MODE_ICONS[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={VIEW_MODE_LABELS[mode]}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-[var(--navy)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-[var(--navy)]"
            } disabled:opacity-50`}
            onClick={() => onChange(mode)}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">{VIEW_MODE_LABELS[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
