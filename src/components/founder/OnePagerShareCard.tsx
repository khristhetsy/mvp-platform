"use client";

import { useState } from "react";

const ACCENT = "#534AB7";

export function OnePagerShareCard({
  slug,
  companyName,
}: {
  slug: string;
  companyName: string;
}) {
  const [copied, setCopied] = useState(false);

  // Build the absolute URL client-side
  const href = typeof window !== "undefined"
    ? `${window.location.origin}/f/${slug}`
    : `/f/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select input text
    }
  }

  return (
    <div style={{
      background: "white",
      border: `1px solid #c4b5fd`,
      borderRadius: 14,
      padding: "18px 22px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "#EEEDFE",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" fill={ACCENT} />
            <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm1.5 0c0 4.69 3.81 8.5 8.5 8.5s8.5-3.81 8.5-8.5S16.69 3.5 12 3.5 3.5 7.31 3.5 12z" fill={ACCENT} opacity="0.4" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>
            Your investor one-pager is live
          </p>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
            Share this link with investors — no login required
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* URL pill */}
        <span style={{
          fontSize: 11, color: ACCENT, background: "#EEEDFE",
          borderRadius: 8, padding: "5px 12px", fontFamily: "monospace",
          maxWidth: "min(220px, calc(100vw - 180px))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          /f/{slug}
        </span>

        {/* Copy button */}
        <button
          type="button"
          onClick={copy}
          style={{
            fontSize: 12, fontWeight: 600,
            color: copied ? "#065f46" : ACCENT,
            background: copied ? "#ecfdf5" : "#EEEDFE",
            border: "none", cursor: "pointer",
            borderRadius: 8, padding: "6px 14px",
            transition: "background 0.2s",
          }}
        >
          {copied ? "✓ Copied!" : "Copy link"}
        </button>

        {/* Open in new tab */}
        <a
          href={`/f/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12, fontWeight: 600, color: "white",
            background: ACCENT, borderRadius: 8, padding: "6px 14px",
            textDecoration: "none",
          }}
          aria-label={`Preview one-pager for ${companyName}`}
        >
          Preview ↗
        </a>
      </div>
    </div>
  );
}
