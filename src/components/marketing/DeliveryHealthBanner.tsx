"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Surfaces recent email-delivery problems (invalid Resend key, unverified domain)
// as an in-app banner so admins see the actual blocker instead of silent bounces.
export function DeliveryHealthBanner() {
  const [issues, setIssues] = useState<Array<{ kind: string; message: string }>>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/delivery-health").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (alive && d && Array.isArray(d.issues)) setIssues(d.issues);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (issues.length === 0) return null;

  return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
        ⚠ Emails aren&rsquo;t being delivered — fix the following:
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {issues.map((i) => (
          <li key={i.kind} style={{ fontSize: 12, color: "#7F1D1D" }}>{i.message}</li>
        ))}
      </ul>
      <div style={{ fontSize: 11.5, color: "#7F1D1D", marginTop: 8 }}>
        After fixing the Resend key/domain, set your verified From address under{" "}
        <Link href="/admin/marketing/settings/notifications" style={{ color: "#991B1B", textDecoration: "underline" }}>Marketing → Settings</Link>.
      </div>
    </div>
  );
}
