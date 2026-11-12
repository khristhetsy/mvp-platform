"use client";

import { useState } from "react";
import { AGREEMENT_TERMS, type AgreementDefaults } from "@/lib/billing/premium-agreement-core";
import { SIGNUP_FOUNDER_PLANS } from "@/lib/subscriptions/plans";
import { CODE_DEFAULT_PRICING, priceLabel as labelOf, priceSublabel, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";

// Bumped when the refund-policy wording changes, so each consent record is
// tied to the exact terms the founder accepted.
const REFUND_POLICY_VERSION = "2025-08-services-rendered";

export function CheckoutButton({
  planType,
  label,
  recommended,
  pricing = CODE_DEFAULT_PRICING,
}: {
  planType: string;
  label: string;
  recommended?: boolean;
  /** Active pricing, passed by the server page. Defaults to the code constants. */
  pricing?: PricingCatalog;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  // Premium carries the iCFO Services Agreement: details, then review, then a check mark, then the usual confirm step.
  const isPremium = planType === "founder_premium";
  const [stage, setStage] = useState<"loading" | "details" | "review" | "confirm">("confirm");
  const [form, setForm] = useState({ companyName: "", companyAddress: "", companyEmail: "", acceptedName: "", acceptedTitle: "" });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);

  const plan = SIGNUP_FOUNDER_PLANS.find((p) => p.planType === planType);
  const planTitle = plan?.title ?? label;
  const priceLabel = labelOf(pricing, planType as never);
  const priceSubtext = priceSublabel(pricing, planType as never);

  function dropPdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }

  function closeDialog() {
    dropPdf();
    setOpen(false);
  }

  async function openConfirm() {
    setConsent(false);
    setAgree(false);
    setAgreeError(null);
    setOpen(true);
    if (!isPremium) {
      setStage("confirm");
      return;
    }
    setStage("loading");
    try {
      const res = await fetch("/api/billing/premium-agreement");
      const data = (await res.json()) as { defaults?: AgreementDefaults; accepted?: { id: string } | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "We could not load the agreement.");
      if (data.accepted) {
        setAcceptedId(data.accepted.id);
        setStage("confirm");
        return;
      }
      const d = data.defaults ?? {};
      setForm((f) => ({
        companyName: f.companyName || d.companyName || "",
        companyAddress: f.companyAddress || d.companyAddress || "",
        companyEmail: f.companyEmail || d.companyEmail || "",
        acceptedName: f.acceptedName || d.acceptedName || "",
        acceptedTitle: f.acceptedTitle || d.acceptedTitle || "",
      }));
      setStage("details");
    } catch (e) {
      setAgreeError(e instanceof Error ? e.message : "We could not load the agreement.");
      setStage("details");
    }
  }

  const formComplete = Object.values(form).every((v) => v.trim().length > 0);

  async function reviewAgreement() {
    if (!formComplete) return;
    setBusy(true);
    setAgreeError(null);
    try {
      const res = await fetch("/api/billing/premium-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "We could not prepare the agreement.");
      }
      dropPdf();
      setPdfUrl(URL.createObjectURL(await res.blob()));
      setAgree(false);
      setStage("review");
    } catch (e) {
      setAgreeError(e instanceof Error ? e.message : "We could not prepare the agreement.");
    }
    setBusy(false);
  }

  async function acceptAgreement() {
    if (!agree) return;
    setBusy(true);
    setAgreeError(null);
    try {
      const res = await fetch("/api/billing/premium-agreement/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, agree: true }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "We could not record your acceptance.");
      setAcceptedId(data.id);
      dropPdf();
      setStage("confirm");
    } catch (e) {
      setAgreeError(e instanceof Error ? e.message : "We could not record your acceptance.");
    }
    setBusy(false);
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
      const data = (await res.json()) as { url?: string; error?: string; code?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        if (data.code === "agreement_required") {
          setAcceptedId(null);
          setStage("details");
        }
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
          onClick={() => !loading && !busy && closeDialog()}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(12,35,64,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: stage === "confirm" || stage === "loading" ? 400 : 720, maxWidth: "94vw", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid #e2e6ed" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#0c2340" }}>{stage === "details" || stage === "review" ? "Accept your Services Agreement" : "Confirm your subscription"}</div>
              <button type="button" onClick={closeDialog} aria-label="Close" style={{ border: "none", background: "transparent", color: "#98a4b8", fontSize: 16, cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
            </div>

            {stage === "loading" ? (
              <div style={{ padding: "28px 20px", fontSize: 13, color: "#5b6b85" }}>Loading your agreement…</div>
            ) : null}

            {stage === "details" ? (
              <>
                <div style={{ padding: "18px 20px", maxHeight: "70vh", overflowY: "auto" }}>
                  <div style={{ fontSize: 13, color: "#5b6b85", marginBottom: 12 }}>Premium includes a Services Agreement with iCFO. Check the details, then review and accept it.</div>
                  <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                    {AGREEMENT_TERMS.map((t, i) => (
                      <div key={t.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 12px", fontSize: 13.5, borderTop: i ? "0.5px solid #e2e6ed" : "none" }}>
                        <span style={{ color: "#5b6b85" }}>{t.label}</span>
                        <span style={{ color: "#0c2340", textAlign: "right" }}>{t.value}</span>
                      </div>
                    ))}
                  </div>
                  <label htmlFor="agr-company" style={{ display: "block", fontSize: 12, color: "#5b6b85", margin: "10px 0 3px" }}>Company legal name</label>
                  <input id="agr-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} maxLength={200} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cfd6e2", borderRadius: 8, padding: "9px 10px", fontSize: 14, color: "#0c2340", background: "#fff", fontFamily: "inherit" }} />
                  <label htmlFor="agr-address" style={{ display: "block", fontSize: 12, color: "#5b6b85", margin: "10px 0 3px" }}>Company address</label>
                  <textarea id="agr-address" rows={3} value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} maxLength={400} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cfd6e2", borderRadius: 8, padding: "9px 10px", fontSize: 14, color: "#0c2340", background: "#fff", fontFamily: "inherit" }} />
                  <label htmlFor="agr-email" style={{ display: "block", fontSize: 12, color: "#5b6b85", margin: "10px 0 3px" }}>Email for notices</label>
                  <input id="agr-email" type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} maxLength={200} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cfd6e2", borderRadius: 8, padding: "9px 10px", fontSize: 14, color: "#0c2340", background: "#fff", fontFamily: "inherit" }} />
                  <label htmlFor="agr-name" style={{ display: "block", fontSize: 12, color: "#5b6b85", margin: "10px 0 3px" }}>Your name</label>
                  <input id="agr-name" value={form.acceptedName} onChange={(e) => setForm({ ...form, acceptedName: e.target.value })} maxLength={200} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cfd6e2", borderRadius: 8, padding: "9px 10px", fontSize: 14, color: "#0c2340", background: "#fff", fontFamily: "inherit" }} />
                  <label htmlFor="agr-title" style={{ display: "block", fontSize: 12, color: "#5b6b85", margin: "10px 0 3px" }}>Your title</label>
                  <input id="agr-title" value={form.acceptedTitle} onChange={(e) => setForm({ ...form, acceptedTitle: e.target.value })} maxLength={200} style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #cfd6e2", borderRadius: 8, padding: "9px 10px", fontSize: 14, color: "#0c2340", background: "#fff", fontFamily: "inherit" }} />
                  {agreeError ? <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "#b42318" }}>{agreeError}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "0.5px solid #e2e6ed" }}>
                  <button type="button" onClick={closeDialog} disabled={busy} style={{ fontSize: 13, padding: "10px 16px", borderRadius: 9, border: "0.5px solid #e2e6ed", background: "transparent", color: "#0c2340", fontWeight: 500, cursor: "pointer" }}>Cancel</button>
                  <button type="button" onClick={reviewAgreement} disabled={busy || !formComplete} aria-disabled={busy || !formComplete} style={{ flex: 1, fontSize: 14, padding: 10, borderRadius: 9, border: "none", background: "#2E78F5", color: "#fff", fontWeight: 500, cursor: busy || !formComplete ? "not-allowed" : "pointer", opacity: busy || !formComplete ? 0.55 : 1 }}>{busy ? "Preparing…" : "Review and accept agreement"}</button>
                </div>
              </>
            ) : null}

            {stage === "review" ? (
              <>
                <div style={{ padding: "14px 20px", maxHeight: "74vh", overflowY: "auto" }}>
                  {pdfUrl ? (
                    <iframe title="iCFO Services Agreement" src={pdfUrl} style={{ width: "100%", height: "46vh", border: "0.5px solid #e2e6ed", borderRadius: 10 }} />
                  ) : null}
                  <div style={{ display: "flex", gap: 14, margin: "8px 0 0", fontSize: 12.5 }}>
                    {pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#2E78F5" }}>Open full agreement</a> : null}
                    {pdfUrl ? <a href={pdfUrl} download="iCFO-Services-Agreement.pdf" style={{ color: "#2E78F5" }}>Download a copy first</a> : null}
                  </div>
                  <label style={{ marginTop: 14, display: "flex", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: "#3a4a63", cursor: "pointer" }}>
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, width: 15, height: 15, accentColor: "#2E78F5" }} />
                    <span>I am authorized to accept this agreement for <strong style={{ color: "#0c2340" }}>{form.companyName}</strong> and I agree to the Services Agreement.</span>
                  </label>
                  {agreeError ? <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "#b42318" }}>{agreeError}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "0.5px solid #e2e6ed" }}>
                  <button type="button" onClick={() => { dropPdf(); setStage("details"); }} disabled={busy} style={{ fontSize: 13, padding: "10px 16px", borderRadius: 9, border: "0.5px solid #e2e6ed", background: "transparent", color: "#0c2340", fontWeight: 500, cursor: "pointer" }}>Back</button>
                  <button type="button" onClick={acceptAgreement} disabled={busy || !agree} aria-disabled={busy || !agree} style={{ flex: 1, fontSize: 14, padding: 10, borderRadius: 9, border: "none", background: "#2E78F5", color: "#fff", fontWeight: 500, cursor: busy || !agree ? "not-allowed" : "pointer", opacity: busy || !agree ? 0.55 : 1 }}>{busy ? "Recording…" : "Agree and continue"}</button>
                </div>
              </>
            ) : null}

            {stage === "confirm" ? (
              <>
                {isPremium && acceptedId ? (
                  <div style={{ padding: "12px 20px 0", fontSize: 12.5, color: "#067647" }}>
                    Services Agreement accepted. <a href={`/api/billing/premium-agreement?acceptance=${acceptedId}`} style={{ color: "#2E78F5" }}>Download a copy</a>
                  </div>
                ) : null}
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
              <button type="button" onClick={closeDialog} disabled={loading} style={{ fontSize: 13, padding: "10px 16px", borderRadius: 9, border: "0.5px solid #e2e6ed", background: "transparent", color: "#0c2340", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}>Cancel</button>
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
              </>
            ) : null}
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
