"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AutomationEngineResult } from "@/lib/automation/types";

type RunState = "idle" | "loading" | "success" | "error";

function formatResult(result: AutomationEngineResult): string {
  return [
    `Triggered: ${result.automationsTriggered}`,
    `Actions: ${result.actionsCreated}`,
    `Blockers: ${result.blockersDetected}`,
    `Deps resolved: ${result.dependenciesResolved}`,
    `Failures: ${result.failures}`,
    `${result.durationMs}ms`,
  ].join(" · ");
}

export function AutomationExecutionControls({ isAdmin }: Readonly<{ isAdmin: boolean }>) {
  const t = useTranslations("adminCmp");
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);

  async function runEngine(dryRun: boolean) {
    setState("loading");
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/run-automation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      const payload = (await res.json().catch(() => null)) as
        | (AutomationEngineResult & { error?: string })
        | { error?: string }
        | null;

      if (res.status === 401) {
        setState("error");
        setError("Session expired. Sign in again.");
        return;
      }

      if (!res.ok || !payload || !("automationsTriggered" in payload)) {
        const errText =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Automation execution failed.";
        setState("error");
        setError(errText);
        return;
      }

      setState("success");
      setMessage(
        `${dryRun ? "Dry test" : "Live pass"} complete. ${formatResult(payload as AutomationEngineResult)}`,
      );
      setConfirmLive(false);
      router.refresh();
    } catch {
      setState("error");
      setError("Network error. Could not reach automation engine.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{t("manual_execution")}</p>
      <p className="mt-0.5 text-xs text-slate-600">{t("bounded_rules_based_passes_in_app_actions_on")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={state === "loading"}
          onClick={() => void runEngine(true)}
          className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
        >
          {state === "loading" ? "Running…" : "Run dry test"}
        </button>
        {isAdmin ? (
          <button
            type="button"
            disabled={state === "loading"}
            onClick={() => setConfirmLive(true)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
          >
            Run bounded live pass
          </button>
        ) : (
          <p className="self-center text-[10px] text-slate-500">{t("live_passes_admin_only")}</p>
        )}
      </div>
      {confirmLive ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <p className="font-semibold">{t("confirm_bounded_live_automation_pass")}</p>
          <p className="mt-1">
            This may create in-app next actions, notifications, and operational events. No external email or
            approvals. Max 25 rules per pass with cooldown guards.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-amber-800 px-2 py-1 text-[10px] font-semibold text-white"
              onClick={() => void runEngine(false)}
            >
              Confirm live pass
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-300 px-2 py-1 text-[10px] font-semibold"
              onClick={() => setConfirmLive(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {state === "success" && message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950" role="status">
          {message}
        </p>
      ) : null}
      {state === "error" && error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
