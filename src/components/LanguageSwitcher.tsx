"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: "en" | "es") {
    if (next === locale) return;
    // pathname includes the locale prefix e.g. /en/founder/dashboard
    // Replace the leading locale segment
    const segments = pathname.split("/");
    segments[1] = next;
    const newPath = segments.join("/");
    startTransition(() => {
      router.push(newPath);
    });
  }

  return (
    <div
      className="flex gap-0.5 rounded-lg border border-slate-200/80 bg-[var(--surface-sunken)] p-0.5"
      aria-label="Switch language"
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchLocale(l)}
          disabled={isPending}
          className={`flex-1 rounded-md py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
            locale === l
              ? "bg-white text-slate-950 shadow-sm border border-slate-200/80"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
