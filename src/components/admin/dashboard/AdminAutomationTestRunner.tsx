"use client";

import { useState } from "react";
import type { AutomationEngineResult } from "@/lib/automation/types";

type RunState = "idle" | "loading" | "success" | "error";

function formatSummary(result: AutomationEngineResult): string {
  return [
    `Automations triggered: ${result.automationsTriggered}`,
    `Actions created: ${result.actionsCreated}`,
    `Blockers detected: ${result.blockersDetected}`,
    `Dependencies resolved: ${result.dependenciesResolved}`,
    `Failures: ${result.failures}`,
    `Duration: ${result.durationMs}ms`,
  ].join(" · ");
}

export function AdminAutomationTestRunner({ isStaff }: Readonly<{ isStaff: boolean }>) {
  const [state, setState] = useState<RunState>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isStaff) return null;

  async function handleRun() {
    setState("loading");
    setSummary(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/run-automation-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });

      const payload = (await res.json().catch(() => null)) as
        | (AutomationEngineResult & { error?: string })
        | { error?: string; success?: boolean }
        | null;

      if (res.status === 401) {
        setState("error");
        setErrorMessage("Session expired. Sign in again as admin or analyst.");
        return;
      }

      if (!res.ok || !payload || "error" in payload && payload.error && !("automationsTriggered" in payload)) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Automation dry test failed. Try again or check server logs.";
        setState("error");
        setErrorMessage(message);
        return;
      }

      if (!("automationsTriggered" in payload)) {
        setState("error");
        setErrorMessage("Unexpected response from automation engine.");
        return;
      }

      setState("success");
      setSummary(formatSummary(payload as AutomationEngineResult));
    } catch {
      setState("error");
      setErrorMessage("Network error. Could not reach the automation engine.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Run Automation Dry Test</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Executes workflow automation in safe dry-run mode
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Temporary internal testing utility.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={state === "loading"}
          className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "loading" ? "Running…" : "Run dry test"}
        </button>
      </div>

      {state === "loading" ? (
        <p className="mt-3 text-xs text-slate-600" role="status">
          Running automation engine (dry-run)…
        </p>
      ) : null}

      {state === "success" && summary ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950" role="status">
          <span className="font-semibold">Dry test complete. </span>
          {summary}
        </p>
      ) : null}

      {state === "error" && errorMessage ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-900" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
