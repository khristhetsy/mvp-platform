"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "capitalos_first_run_dismissed";

function getIsDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch { /* ignore */ }
}

const STEPS = [
  {
    step: 1,
    icon: "📄",
    title: "Upload your first document",
    description: "Start with your pitch deck or financial model. Documents build your readiness score and unlock investor data rooms.",
    action: { label: "Go to Documents", href: "/founder/documents" },
  },
  {
    step: 2,
    icon: "🎯",
    title: "Add an investor to your CRM",
    description: "Track your outreach in one place. Add investors manually or import from a spreadsheet.",
    action: { label: "Open CRM", href: "/founder/investors/outreach" },
  },
  {
    step: 3,
    icon: "🚀",
    title: "Share your investor one-pager",
    description: "Publish your company profile and send a shareable link to investors — no login required on their end.",
    action: { label: "Go to Settings", href: "/founder/settings" },
  },
] as const;

type Props = {
  /** Pass true when the founder has zero documents — shows the modal */
  hasNoDocuments: boolean;
};

export function FirstRunModal({ hasNoDocuments }: Props) {
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (hasNoDocuments && !getIsDismissed()) {
      // Short delay so it doesn't flash on page load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [hasNoDocuments]);

  function dismiss() {
    setDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  const currentStep = STEPS[activeStep];
  const isLast = activeStep === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9980,
          background: "rgba(15,15,30,0.45)",
          backdropFilter: "blur(3px)",
          animation: "frFadeIn 0.2s ease both",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9981,
        width: "min(520px, calc(100vw - 32px))",
        background: "white",
        borderRadius: 20,
        boxShadow: "0 32px 80px rgba(83,74,183,0.22), 0 8px 32px rgba(0,0,0,0.10)",
        overflow: "hidden",
        animation: "frSlideUp 0.28s cubic-bezier(0.34,1.4,0.64,1) both",
      }}>
        <style>{`
          @keyframes frFadeIn   { from { opacity: 0 } to { opacity: 1 } }
          @keyframes frSlideUp  { from { opacity: 0; transform: translate(-50%, calc(-50% + 24px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
        `}</style>

        {/* Header strip */}
        <div style={{
          background: "linear-gradient(135deg, #534AB7 0%, #7c73e6 100%)",
          padding: "24px 28px 20px",
          position: "relative",
        }}>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              position: "absolute", top: 14, right: 16,
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 4px" }}>
            Getting started
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>
            3 steps to your first investor meeting
          </h2>

          {/* Step dots */}
          <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveStep(i)}
                style={{
                  width: i === activeStep ? 20 : 8,
                  height: 8,
                  borderRadius: 99,
                  background: i === activeStep ? "white" : "rgba(255,255,255,0.35)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: "28px 28px 24px" }}>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "#EEEDFE",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
            }}>
              {currentStep.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 4px" }}>
                Step {currentStep.step} of {STEPS.length}
              </p>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 8px", lineHeight: 1.3 }}>
                {currentStep.title}
              </h3>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {activeStep > 0 && (
              <button
                type="button"
                onClick={() => setActiveStep((s) => s - 1)}
                style={{
                  fontSize: 13, fontWeight: 600, color: "#6b7280",
                  background: "#f3f4f6", border: "none", borderRadius: 10,
                  padding: "9px 18px", cursor: "pointer",
                }}
              >
                Back
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setActiveStep((s) => s + 1)}
                style={{
                  fontSize: 13, fontWeight: 600, color: "white",
                  background: "#534AB7", border: "none", borderRadius: 10,
                  padding: "9px 18px", cursor: "pointer",
                }}
              >
                Next step →
              </button>
            ) : (
              <Link
                href={currentStep.action.href}
                onClick={dismiss}
                style={{
                  fontSize: 13, fontWeight: 600, color: "white",
                  background: "#534AB7", borderRadius: 10,
                  padding: "9px 18px", textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {currentStep.action.label} →
              </Link>
            )}

            <Link
              href={currentStep.action.href}
              onClick={dismiss}
              style={{
                fontSize: 13, fontWeight: 600, color: "#534AB7",
                background: "#EEEDFE", borderRadius: 10,
                padding: "9px 18px", textDecoration: "none",
                display: isLast ? "none" : "inline-block",
              }}
            >
              {currentStep.action.label}
            </Link>
          </div>

          {/* Skip */}
          <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            <button
              type="button"
              onClick={dismiss}
              style={{
                fontSize: 12, color: "#9ca3af",
                background: "none", border: "none", cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Skip for now
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
