"use client";

import { useState } from "react";

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

  async function handleClick() {
    setLoading(true);
    try {
      const res  = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planType }),
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        fontSize: 13,
        padding: "8px 20px",
        borderRadius: 8,
        border: recommended ? "none" : "0.5px solid #e2e6ed",
        background: recommended ? "#534AB7" : "transparent",
        color: recommended ? "#EEEDFE" : "#0c2340",
        cursor: "pointer",
        opacity: loading ? 0.6 : 1,
        fontWeight: 500,
      }}
    >
      {loading ? "Redirecting…" : label}
    </button>
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
