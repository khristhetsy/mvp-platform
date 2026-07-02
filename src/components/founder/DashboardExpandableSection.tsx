"use client";

import { useState } from "react";

type Props = {
  children: React.ReactNode;
  /** Label shown on the toggle button when collapsed */
  showLabel?: string;
  /** Label shown on the toggle button when expanded */
  hideLabel?: string;
};

/**
 * Wraps secondary dashboard sections behind a "Show more / Show less" toggle.
 * Content is hidden by default to keep the dashboard focused.
 */
export function DashboardExpandableSection({
  children,
  showLabel = "Show more",
  hideLabel = "Show less",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: expanded ? 0 : 8 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#2E78F5",
            background: "#EEEDFE",
            border: "none",
            borderRadius: 99,
            padding: "7px 18px",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#dbd9fc"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EEEDFE"; }}
        >
          {expanded ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 15l-6-6-6 6" stroke="#2E78F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {hideLabel}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="#2E78F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {showLabel}
            </>
          )}
        </button>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {children}
        </div>
      )}
    </>
  );
}
