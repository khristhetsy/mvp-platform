"use client";

import { useState } from "react";

const ACCENT = "#534AB7";

type State = {
  isPublished: boolean;
  slug: string | null;
};

export function OnePagerPublishCard({
  initialIsPublished,
  initialSlug,
  companyName,
}: {
  initialIsPublished: boolean;
  initialSlug: string | null;
  companyName: string;
}) {
  const [state, setState] = useState<State>({
    isPublished: initialIsPublished,
    slug: initialSlug,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const href =
    state.slug
      ? (typeof window !== "undefined"
          ? `${window.location.origin}/f/${state.slug}`
          : `/f/${state.slug}`)
      : null;

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const action = state.isPublished ? "unpublish" : "publish";
      const res = await fetch("/api/founder/one-pager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { slug?: string; is_published?: boolean; error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setState({
          isPublished: json.is_published ?? !state.isPublished,
          slug: json.slug ?? state.slug,
        });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }

  return (
    <div style={{
      background: "white",
      border: `1px solid ${state.isPublished ? "#c4b5fd" : "#e5e7eb"}`,
      borderRadius: 14,
      padding: "20px 24px",
      marginBottom: 20,
    }}>
      {/* Header row */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: state.isPublished ? "#EEEDFE" : "#f3f4f6",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"
                fill={state.isPublished ? ACCENT : "#94a3b8"}
              />
              <path
                d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm1.5 0c0 4.69 3.81 8.5 8.5 8.5s8.5-3.81 8.5-8.5S16.69 3.5 12 3.5 3.5 7.31 3.5 12z"
                fill={state.isPublished ? ACCENT : "#94a3b8"}
                opacity="0.4"
              />
            </svg>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>
                Investor one-pager
              </p>
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: state.isPublished ? "#dcfce7" : "#f1f5f9",
                color: state.isPublished ? "#065f46" : "#64748b",
                borderRadius: 20, padding: "2px 8px",
              }}>
                {state.isPublished ? "Live" : "Off"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "3px 0 0", lineHeight: 1.4 }}>
              {state.isPublished
                ? "Investors can view your one-pager — no login required"
                : `Enable a shareable link for ${companyName}`}
            </p>
          </div>
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12, fontWeight: 700,
            color: state.isPublished ? "#991b1b" : "white",
            background: state.isPublished ? "#fef2f2" : ACCENT,
            border: state.isPublished ? "1px solid #fecaca" : "none",
            borderRadius: 9, padding: "8px 16px",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true">
                <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {state.isPublished ? "Disabling…" : "Enabling…"}
            </>
          ) : state.isPublished ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Disable link
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Enable link
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p style={{
          marginTop: 12, fontSize: 12,
          color: "#991b1b", background: "#fee2e2",
          borderRadius: 8, padding: "8px 12px",
        }}>
          {error}
        </p>
      )}

      {/* Share row — only when live */}
      {state.isPublished && state.slug && (
        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}>
          {/* URL pill */}
          <span style={{
            fontSize: 11, color: ACCENT, background: "#EEEDFE",
            borderRadius: 8, padding: "5px 12px",
            fontFamily: "monospace",
            maxWidth: "min(300px, calc(100vw - 200px))",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {href ?? `/f/${state.slug}`}
          </span>

          <button
            type="button"
            onClick={() => void copy()}
            style={{
              fontSize: 12, fontWeight: 600,
              color: copied ? "#065f46" : ACCENT,
              background: copied ? "#ecfdf5" : "#EEEDFE",
              border: "none", cursor: "pointer",
              borderRadius: 8, padding: "6px 14px",
            }}
          >
            {copied ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Copied!
              </span>
            ) : "Copy link"}
          </button>

          <a
            href={`/f/${state.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 600, color: "white",
              background: ACCENT, borderRadius: 8, padding: "6px 14px",
              textDecoration: "none",
            }}
            aria-label={`Preview one-pager for ${companyName}`}
          >
            Preview
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <polyline points="15 3 21 3 21 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="14" x2="21" y2="3" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
