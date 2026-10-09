"use client";

/** Pause imports, suspend access, or reactivate, on one founder's usage record. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { postJson } from "@/components/admin/investor-directory/ui";

export function FounderAccessActions({ founderId, status }: Readonly<{ founderId: string; status: "active" | "paused" | "suspended" }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: "active" | "paused" | "suspended") {
    if (next === "suspended" && !(await confirmDialog({ message: "Suspend this founder's directory access? They can't search or import until reactivated.", danger: true, confirmLabel: "Suspend" }))) return;
    setBusy(true);
    const reason = next === "paused" ? "Imports paused by iCFO while we review your usage." : next === "suspended" ? "Directory access suspended by iCFO." : undefined;
    const r = await postJson("/api/admin/investor-directory/access/founder", "PATCH", { founderId, status: next, reason });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <>
          <button type="button" disabled={busy} onClick={() => void set("paused")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] hover:bg-slate-50">Pause imports</button>
          <button type="button" disabled={busy} onClick={() => void set("suspended")} className="rounded-lg border border-[#F7C1C1] px-3 py-1.5 text-[12.5px] text-[#A32D2D] hover:bg-[#FCEBEB]">Suspend access</button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void set("active")} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">Reactivate</button>
      )}
      {error ? <span className="text-[12px] text-[#A32D2D]">{error}</span> : null}
    </div>
  );
}
