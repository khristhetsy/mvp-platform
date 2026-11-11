"use client";
// Next task bar. Target: src/app/admin/sales/contacts/[id]/NextTaskBar.tsx
// Shown at the top of a contact's Tasks tab when the contact was opened from the Task report.
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ptToday } from "@/lib/reminders/pt";
import { dueText, nextInQueue, parseQueue, readQueueRaw } from "@/lib/task-report/next-task";

export function NextTaskBar() {
  const router = useRouter();
  const pathname = usePathname();
  // The queue lives in sessionStorage, which only exists in the browser; the server renders nothing.
  const raw = useSyncExternalStore(() => () => {}, readQueueRaw, () => null);
  const queue = useMemo(() => parseQueue(raw), [raw]);

  if (!queue.some((q) => q.href.split("?")[0] === pathname)) return null;
  const next = nextInQueue(queue, pathname);
  const due = next ? dueText(next.due, ptToday()) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#fff", border: "0.5px solid #d9dcf5", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "#4338CA", background: "#ECEBFC", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>NEXT OPEN TASK</span>
        {next && due ? (
          <>
            {next.type && <span style={{ fontSize: 11.5, fontWeight: 600, background: "#E4EEFB", color: "#1D4F9F", borderRadius: 6, padding: "2px 8px" }}>{next.type}</span>}
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.contactName ?? "No contact"}</span>
            <span style={{ fontSize: 12, color: due.overdue ? "#A32D2D" : "var(--muted-foreground)", whiteSpace: "nowrap" }}>{due.text}</span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No more open tasks in your list</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/admin/sales/task-report?view=tasks" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--foreground)", border: "0.5px solid #cfd3dc", borderRadius: 8, padding: "8px 14px", textDecoration: "none", background: "#fff" }}>Back to task report</Link>
        <button type="button" disabled={!next} onClick={() => next && router.push(next.href)} style={{ fontSize: 12.5, fontWeight: 600, color: next ? "#fff" : "#5B6272", background: next ? "#2E78F5" : "#C9CED8", border: "none", borderRadius: 8, padding: "8px 16px", cursor: next ? "pointer" : "not-allowed" }}>
          Next task <i className="ti ti-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
