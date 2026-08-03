"use client";

import { useState } from "react";

// Bumped when the refund-policy wording changes, so each consent record is
// tied to the exact terms the founder accepted.
const REFUND_POLICY_VERSION = "2025-08-services-rendered";

export function CheckoutButton({
  planType,
  label,
  recommended,
}: {
  planType: string;
  label: string;
  recommended?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  async function handleClick() {
    if (!consent) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          planType,
          refundPolicyAcceptedAt: new Date().toISOString(),
          refundPolicyVersion: REFUND_POLICY_VERSION,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Something went wrong.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

  const blocked = loading || !consent;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <label style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5, color: "#5b6b85", cursor: "pointer", maxWidth: 340 }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        <span>
          I understand my plan begins delivering immediately — AI due diligence and distribution of my materials to matched investors — and that payments are <strong>non-refundable</strong>.
        </span>
      </label>
      <button
        type="button"
        onClick={handleClick}
        disabled={blocked}
        aria-disabled={blocked}
        style={{
          fontSize: 13,
          padding: "8px 20px",
          borderRadius: 8,
          border: recommended ? "none" : "0.5px solid #e2e6ed",
          background: recommended ? "#2E78F5" : "transparent",
          color: recommended ? "#EEEDFE" : "#0c2340",
          cursor: blocked ? "not-allowed" : "pointer",
          opacity: blocked ? 0.55 : 1,
          fontWeight: 500,
        }}
      >
        {loading ? "Redirecting…" : label}
      </button>
    </div>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res  = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "No active subscription found.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        fontSize: 13,
        padding: "8px 20px",
        borderRadius: 8,
        border: "0.5px solid #e2e6ed",
        background: "transparent",
        color: "#0c2340",
        cursor: "pointer",
        opacity: loading ? 0.6 : 1,
        fontWeight: 500,
      }}
    >
      {loading ? "Loading…" : "Manage subscription"}
    </button>
  );
}
