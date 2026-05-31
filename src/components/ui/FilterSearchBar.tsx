"use client";

import { Search } from "lucide-react";

export function FilterSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  disabled,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}>) {
  return (
    <label className="relative block min-w-[200px] flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--navy)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/20"
      />
    </label>
  );
}
