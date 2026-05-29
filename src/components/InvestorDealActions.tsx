"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";

type ViewerRole = "investor" | "founder" | "admin" | "analyst" | null;

type Props = {
  companyId: string;
  companySlug: string;
  companyName: string;
  viewerRole: ViewerRole;
  isOwnCompany: boolean;
  pitchDeckDocumentId: string | null;
  signInNextPath: string;
};

export function InvestorDealActions({
  companyId,
  companySlug,
  companyName,
  viewerRole,
  isOwnCompany,
  pitchDeckDocumentId,
  signInNextPath,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [interestAmount, setInterestAmount] = useState("");
  const [message, setMessage] = useState("");

  async function callApi(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(formatApiError(payload, "Action failed."));
    }

    return payload;
  }

  async function runAction(actionKey: string, fn: () => Promise<void>) {
    setLoading(actionKey);
    setError(null);
    setSuccess(null);

    try {
      await fn();
      setSuccess("Saved successfully.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setLoading(null);
    }
  }

  async function expressInterest() {
    await runAction("interest", async () => {
      await callApi("/api/investor/interests", {
        companyId,
        companySlug,
        interestAmount: interestAmount ? Number(interestAmount) : undefined,
        message: message.trim() || undefined,
      });
    });
  }

  async function requestIntro() {
    await runAction("intro", async () => {
      await callApi("/api/investor/intro-requests", {
        companyId,
        companySlug,
        message: message.trim() || `Intro request for ${companyName}.`,
      });
    });
  }

  async function saveDeal() {
    await runAction("save", async () => {
      await callApi("/api/investor/saved-deals", { companyId, companySlug });
    });
  }

  async function requestFollowUp() {
    await runAction("follow_up", async () => {
      await callApi("/api/investor/follow-up", {
        companyId,
        companySlug,
        message: message.trim() || `ICFO follow-up requested for ${companyName}.`,
      });
    });
  }

  async function viewPitchDeck() {
    if (!pitchDeckDocumentId) {
      setError("No pitch deck is available for this listing.");
      return;
    }

    await runAction("pitch_deck", async () => {
      const payload = await callApi("/api/documents/signed-url", { documentId: pitchDeckDocumentId });
      if (!payload.signedUrl) {
        throw new Error("Unable to open pitch deck.");
      }
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  if (!viewerRole) {
    return (
      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Investor actions</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in as an investor to express interest, request an intro, or save this deal.
        </p>
        <Link
          href={`/auth/sign-in?next=${encodeURIComponent(signInNextPath)}`}
          className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Sign in as investor
        </Link>
      </aside>
    );
  }

  if (viewerRole === "founder" || isOwnCompany) {
    return (
      <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Marketplace view</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isOwnCompany
            ? "This is your company listing. Founder accounts cannot perform investor actions on their own deal."
            : "Founder accounts have read-only access to marketplace listings. Investor actions are hidden."}
        </p>
      </aside>
    );
  }

  if (viewerRole !== "investor") {
    return (
      <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Investor actions</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Only investor accounts can express interest or request intros on marketplace deals.
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Investor actions</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Expressing interest or requesting an intro does not create an investment commitment, allocation, or guarantee
        of returns.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-5 grid gap-4">
        <input
          value={interestAmount}
          onChange={(event) => setInterestAmount(event.target.value)}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
          placeholder="Indicative interest amount"
          inputMode="decimal"
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          className="rounded-2xl border border-slate-300 p-4 text-sm"
          placeholder="Optional note for the platform team"
        />

        <button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => expressInterest()}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading === "interest" ? "Saving..." : "Express Interest"}
        </button>
        <button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => requestIntro()}
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {loading === "intro" ? "Saving..." : "Request Intro"}
        </button>
        <button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => saveDeal()}
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {loading === "save" ? "Saving..." : "Save Deal"}
        </button>
        <button
          type="button"
          disabled={Boolean(loading) || !pitchDeckDocumentId}
          onClick={() => viewPitchDeck()}
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {loading === "pitch_deck" ? "Opening..." : "View Pitch Deck"}
        </button>
        <button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => requestFollowUp()}
          className="rounded-full border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-900 disabled:opacity-50"
        >
          {loading === "follow_up" ? "Submitting..." : "Contact Platform / Request ICFO Follow-up"}
        </button>
      </div>
    </aside>
  );
}
