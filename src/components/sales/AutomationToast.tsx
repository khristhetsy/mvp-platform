"use client";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type Approval = { id: string; opportunity_id: string; to_stage_name?: string | null; reason: string };

/**
 * Checks for new CRM automation suggestions once a minute while a Sales page is open
 * and shows each new one as a toast. The first check only records what is already waiting.
 */
export function AutomationToast() {
  const { toast } = useToast();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const res = await fetch("/api/sales/automation/approvals", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const { approvals } = (await res.json()) as { approvals: Approval[] };
        if (seen.current === null) { seen.current = new Set(approvals.map((a) => a.id)); return; }
        for (const a of approvals) {
          if (seen.current.has(a.id)) continue;
          seen.current.add(a.id);
          toast({ title: `Move to ${a.to_stage_name ?? "the next stage"}?`, description: `Because ${a.reason}. Open the opportunity to answer.`, variant: "info" });
        }
      } catch { /* try again next minute */ }
    }
    void check();
    const t = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [toast]);

  return null;
}
