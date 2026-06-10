"use client";

import { VIEW_DENSITY_LABELS, type ViewDensity } from "@/lib/ui/view-modes";

export function ViewDensityToggle({
  value,
  onChange,
  disabled,
}: Readonly<{
  value: ViewDensity;
  onChange: (density: ViewDensity) => void;
  disabled?: boolean;
}>) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="View density">
      {(["compact", "comfortable"] as const).map((density) => {
        const active = value === density;
        return (
          <button
            key={density}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={`${VIEW_DENSITY_LABELS[density]} density`}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              active ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:text-slate-700"
            } disabled:opacity-50`}
            onClick={() => onChange(density)}
          >
            {VIEW_DENSITY_LABELS[density]}
          </button>
        );
      })}
    </div>
  );
}
