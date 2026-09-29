"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Issue = { kind: string; message: string; severity?: "blocker" | "warning" };

// Surfaces recent email-delivery problems as an in-app banner. Blockers (invalid Resend
// key, unverified domain) stop all sending and show in red; per-contact problems
// (malformed addresses) only skip those contacts and show as an amber notice.
export function DeliveryHealthBanner() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/delivery-health").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (alive && d && Array.isArray(d.issues)) setIssues(d.issues);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const blockers = issues.filter((i) => i.severity !== "warning");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) return null;

  return (
    <>
      {blockers.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" /> Emails aren&rsquo;t being delivered. Fix the following:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {blockers.map((i) => (
              <li key={i.kind} style={{ fontSize: 12, color: "#7F1D1D" }}>{i.message}</li>
            ))}
          </ul>
          <div style={{ fontSize: 11.5, color: "#7F1D1D", marginTop: 8 }}>
            After fixing the Resend key/domain, set your verified From address under{" "}
            <Link href="/admin/marketing/settings/notifications" style={{ color: "#991B1B", textDecoration: "underline" }}>Marketing → Settings</Link>.
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          {warnings.map((i) => (
            <div key={i.kind} style={{ fontSize: 12, color: "#92400E" }}>
              <i className="ti ti-info-circle" aria-hidden="true" /> {i.message}{" "}
              {i.kind === "bad_recipient" && (
                <Link href="/admin/marketing/contacts" style={{ color: "#92400E", textDecoration: "underline" }}>Open contacts</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
