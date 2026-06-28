"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "capitalos_investor_first_run_dismissed";

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
    icon: "🧭",
    title: "Complete your investor profile",
    description: "Add your investment preferences so opportunity matching personalizes to your thesis, and submit for approval to unlock the marketplace.",
    action: { label: "Complete profile", href: "/investor/onboarding" },
  },
  {
    icon: "🔍",
    title: "Browse matched opportunities",
    description: "Explore companies ranked for your preferences in the Private Market. Filters help you focus on stage, sector, and geography.",
    action: { label: "View opportunities", href: "/investor/opportunities" },
  },
  {
    icon: "⭐",
    title: "Save deals and express interest",
    description: "Add promising companies to your watchlist, express interest, and request introductions — founders are notified instantly.",
    action: { label: "Open watchlist", href: "/investor/watchlist" },
  },
] as const;

export function InvestorFirstRunModal({ isNew }: { isNew: boolean }) {
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (isNew && !getIsDismissed()) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  function dismiss() {
    setDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  const currentStep = STEPS[activeStep];
  const isLast = activeStep === STEPS.length - 1;

  return (
    <>
      <div
        onClick={dismiss}
        style={{ position: "fixed", inset: 0, zIndex: 9980, background: "rgba(15,15,30,0.45)", backdropFilter: "blur(3px)", animation: "ifrFadeIn 0.2s ease both" }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9981,
        width: "min(520px, calc(100vw - 32px))", background: "white", borderRadius: 20,
        boxShadow: "0 32px 80px rgba(83,74,183,0.22), 0 8px 32px rgba(0,0,0,0.10)", overflow: "hidden",
        animation: "ifrSlideUp 0.28s cubic-bezier(0.34,1.4,0.64,1) both",
      }}>
        <style>{`
          @keyframes ifrFadeIn  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes ifrSlideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 24px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
        `}</style>

        <div style={{ background: "linear-gradient(135deg, #534AB7 0%, #7c73e6 100%)", padding: "24px 28px 20px", position: "relative" }}>
          <button
            type="button" onClick={dismiss} aria-label="Dismiss"
            style={{ position: "absolute", top: 14, right: 16, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 4px" }}>
            Getting started
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0, lineHeight: 1.2 }}>
            3 steps to your first deal
          </h2>
          <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
            {STEPS.map((_, i) => (
              <button
                key={i} type="button" onClick={() => setActiveStep(i)} aria-label={`Step ${i + 1}`}
                style={{ width: i === activeStep ? 20 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: i === activeStep ? "white" : "rgba(255,255,255,0.4)", transition: "width 0.2s" }}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: "24px 28px 26px" }}>
          <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 12 }} aria-hidden>{currentStep.icon}</div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#534AB7", margin: "0 0 4px" }}>Step {activeStep + 1} of {STEPS.length}</p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{currentStep.title}</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#475569", margin: "0 0 20px" }}>{currentStep.description}</p>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href={currentStep.action.href} onClick={dismiss}
              style={{ display: "inline-flex", alignItems: "center", background: "#534AB7", color: "white", textDecoration: "none", fontWeight: 600, fontSize: 14, padding: "10px 18px", borderRadius: 10 }}
            >
              {currentStep.action.label} →
            </Link>
            {!isLast ? (
              <button
                type="button" onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Next
              </button>
            ) : (
              <button
                type="button" onClick={dismiss}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
