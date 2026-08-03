"use client";

import { useState } from "react";
import { SIGNUP_FOUNDER_PLANS } from "@/lib/subscriptions/plans";

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  const plan = SIGNUP_FOUNDER_PLANS.find((p) => p.planType === planType);
  const planTitle = plan?.title ?? label;
  const priceLabel = plan?.priceLabel;
  const priceSubtext = plan?.priceSubtext ?? "/month";

  function openConfirm() {
    setConsent(false);
    setOpen(true);
  }

  async function proceed() {
    if (!consent) return;
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType,
          refundPolicyAcceptedAt: new Date().toISOString(),
          refundPolicyVersion: REFUND_POLICY_VERSION,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
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

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        style={{
          fontSize: 13,
          padding: "8px 20px",
          borderRadius: 8,
          border: recommended ? "none" : "0.5px solid #e2e6ed",
          background: recommended ? "#2E78F5" : "transparent",
          color: recommended ? "#EEEDFE" : "#0c2340",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm your subscription"
          onClick={() => !loading && setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(12,35,64,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: "92vw", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid #e2e6ed" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#0c2340" }}>Confirm your subscription</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: "none", background: "transparent", color: "#98a4b8", fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#0c2340" }}>{planTitle}</div>
                {priceLabel ? (
                  <div style={{ fontSize: 14, color: "#0c2340" }}><strong style={{ fontSize: 16 }}>{priceLabel}</strong> <span style={{ color: "#5b6b85", fontSize: 12 }}>{priceSubtext}</span></div>
                ) : null}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#5b6b85" }}>Billed monthly · cancel anytime to stop future billing</div>

              <div style={{ marginTop: 14, background: "#f5f7fb", border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "12px 14px", fontSize: 12, lineHeight: 1.55, color: "#3a4a63" }}>
                Your plan begins delivering immediately — AI due diligence reporting and distribution of your materials to matched investors in the iCFO network. Because these services are rendered immediately, payments are <strong style={{ color: "#0c2340" }}>non-refundable</strong>, including partial periods.
              </div>

              <label style={{ marginTop: 14, display: "flex", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: "#3a4a63", cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, width: 15, height: 15, accentColor: "#2E78F5" }} />
                <span>I understand my plan begins delivering immediately and that <strong style={{ color: "#0c2340" }}>payments are non-refundable</strong>.</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "0.5px solid #e2e6ed" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={loading} style={{ fontSize: 13, padding: "10px 16px", borderRadius: 9, border: "0.5px solid #e2e6ed", background: "transparent", color: "#0c2340", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}>Cancel</button>
              <button
                type="button"
                onClick={proceed}
                disabled={loading || !consent}
                aria-disabled={loading || !consent}
                style={{ flex: 1, fontSize: 14, padding: 10, borderRadius: 9, border: "none", background: "#2E78F5", color: "#fff", fontWeight: 500, cursor: loading || !consent ? "not-allowed" : "pointer", opacity: loading || !consent ? 0.55 : 1 }}
              >
                {loading ? "Redirecting…" : "Proceed to payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
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
