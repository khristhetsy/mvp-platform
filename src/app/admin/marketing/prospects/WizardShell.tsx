"use client";

// Shared sub-step wizard chrome for a Prospects stage. Renders sub-step chips,
// the active sub-step's content, a Back link and a single contextual Next button.
// On the last sub-step the button becomes "Complete stage → …" and navigates on.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface WizardStep {
  label: string;
  content: React.ReactNode;
}

export function WizardShell({
  steps,
  completeHref,
  completeLabel,
}: {
  steps: WizardStep[];
  completeHref?: string;
  completeLabel?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const last = step === steps.length - 1;

  const nextLabel = last ? (completeLabel ?? "Done") : `Next: ${steps[step + 1].label} →`;
  const showNext = !last || !!completeHref;

  function onNext() {
    if (!last) { setStep(step + 1); return; }
    if (completeHref) router.push(completeHref);
  }

  return (
    <div>
      {/* sub-step chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {steps.map((s, i) => {
          const done = i < step, active = i === step;
          return (
            <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: active ? 800 : done ? 700 : 600, color: done ? "#0F6E56" : active ? "#1A6CE4" : "var(--muted-foreground)" }}>
                {done ? "✓ " : ""}{i + 1} {s.label}
              </span>
              {i < steps.length - 1 ? <span style={{ color: "var(--border-strong,#cbd5e1)" }}>·</span> : null}
            </span>
          );
        })}
      </div>

      {steps[step].content}

      {/* single contextual nav button */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} style={{ fontSize: 11, color: "var(--muted-foreground)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>‹ Back</button>
        ) : null}
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>sub-step {step + 1} of {steps.length}</span>
        {showNext ? (
          <button onClick={onNext} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#fff", background: last ? "#0F6E56" : "#2E78F5", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer" }}>
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
