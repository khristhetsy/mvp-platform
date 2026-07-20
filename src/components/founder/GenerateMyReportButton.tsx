"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Founder self-serve: generate the diligence report for your own company.
 * The company is resolved server-side from the founder's membership, so this
 * sends no body. Capped at one generation per company per 24h.
 */
export function GenerateMyReportButton({
  variant = "primary",
  label = "Generate my report",
}: Readonly<{ variant?: "primary" | "secondary"; label?: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/founder/report/generate", { method: "POST" });
      const j = (await res.json().catch(() => null)) as
        | { error?: string; generation?: { isDemo?: boolean } }
        | null;
      if (!res.ok) throw new Error(j?.error ?? "Report generation failed.");
      setMsg(
        j?.generation?.isDemo
          ? "Report created using sample content — AI is not configured on this environment yet."
          : "Report generated. Refreshing…",
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Report generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "primary"
      ? "cap-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      : "cap-btn-secondary rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] disabled:opacity-60";

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => void run()} disabled={busy} className={cls}>
        {busy ? "Generating… this takes ~20s" : label}
      </button>
      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
      ) : null}
    </div>
  );
}
