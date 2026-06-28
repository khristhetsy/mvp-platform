"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const COOKIE_NAME = "capitalos-locale";
const SUPPORTED = ["en", "es"] as const;
type Locale = (typeof SUPPORTED)[number];

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  return (SUPPORTED as readonly string[]).includes(value ?? "") ? (value as Locale) : "en";
}

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>("en");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(readLocaleCookie());
  }, []);

  function switchLocale(next: Locale) {
    if (next === locale) return;
    // Set cookie (1 year, SameSite=Lax)
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    // Persist to the profile (fire-and-forget) so emails reach the user in this
    // language. No-op for signed-out visitors.
    void fetch("/api/user/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="flex gap-0.5 rounded-lg border border-slate-200/80 bg-[var(--surface-sunken)] p-0.5"
      aria-label="Switch language"
    >
      {SUPPORTED.map((l) => (
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
