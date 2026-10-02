"use client";

import { useState } from "react";
import { QUOTE_MAX, QUOTE_MIN, validateTestimonial } from "@/lib/testimonials/validate";

type Errors = Partial<Record<"quote" | "title" | "consent" | "token", string>>;

export function TestimonialForm({
  token,
  firstName,
  companyName,
  crr,
  alreadyApproved,
}: {
  token: string;
  firstName: string;
  companyName: string | null;
  crr: { start: number; current: number } | null;
  alreadyApproved: boolean;
}) {
  const [quote, setQuote] = useState("");
  const [title, setTitle] = useState("Founder");
  const [anonymous, setAnonymous] = useState(false);
  const [showScore, setShowScore] = useState(crr != null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const payload = { token, quote, title, anonymous, showScore, consent };
    const check = validateTestimonial(payload);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setState("saving");
    try {
      const res = await fetch("/api/testimonial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = (await res.json().catch(() => ({}))) as { errors?: Errors; error?: string };
      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        setServerError(json.error ?? null);
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setServerError("Couldn't reach iCapOS. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="text-center">
        <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Received</p>
        <h1 className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">Thank you, {firstName}</h1>
        <p className="mt-4 text-base leading-7 text-site-muted">Your recommendation is with our team. It appears on icapos.com once it&rsquo;s reviewed, shown the way you chose.</p>
      </div>
    );
  }

  const len = quote.replace(/\s+/g, " ").trim().length;
  const fieldError = "mt-1 text-[13px] text-red-700";

  return (
    <form onSubmit={submit} noValidate>
      <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">Share your story</p>
      <h1 className="mt-2 font-site-display text-3xl font-extrabold tracking-tight text-site-navy">Thanks, {firstName}</h1>
      {crr ? (
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-site-blue-pale px-3 py-1.5 text-[13px] font-semibold text-site-navy">
          <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-site-blue" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
          CRR {crr.start} → {crr.current}{companyName ? ` · ${companyName}` : ""}
        </span>
      ) : null}
      {alreadyApproved ? (
        <p className="mt-4 rounded-lg bg-site-paper px-3 py-2 text-[13px] text-site-muted">Your earlier recommendation is already published. Anything you send here goes to our team as a new version for review.</p>
      ) : null}

      <label htmlFor="quote" className="mt-6 block text-sm font-semibold text-site-navy">Your recommendation</label>
      <textarea
        id="quote"
        value={quote}
        onChange={(e) => { setQuote(e.target.value); if (errors.quote) setErrors((x) => ({ ...x, quote: undefined })); }}
        rows={5}
        maxLength={QUOTE_MAX + 50}
        placeholder="Two or three sentences: where you started, what iCapOS helped you improve, what it means for your raise."
        aria-invalid={Boolean(errors.quote)}
        className="mt-2 w-full rounded-lg border border-site-line p-3 text-[15px] leading-6 text-site-ink outline-none focus:border-site-blue"
      />
      <div className="mt-1 flex justify-between text-[12px] text-site-muted">
        <span>At least {QUOTE_MIN} characters</span>
        <span className={len > QUOTE_MAX ? "text-red-700" : ""}>{len} / {QUOTE_MAX}</span>
      </div>
      {errors.quote ? <p className={fieldError}>{errors.quote}</p> : null}

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-site-navy">How should we show it?</legend>
        <label className="mt-3 flex items-center gap-2 text-[15px] text-site-ink">
          <input type="radio" name="display" checked={!anonymous} onChange={() => setAnonymous(false)} />
          Name, title and company
        </label>
        {!anonymous ? (
          <div className="ml-6 mt-2">
            <label htmlFor="title" className="block text-[13px] text-site-muted">Your title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
              className="mt-1 w-full max-w-xs rounded-lg border border-site-line px-3 py-2 text-[15px] text-site-ink outline-none focus:border-site-blue" />
            {errors.title ? <p className={fieldError}>{errors.title}</p> : null}
          </div>
        ) : null}
        <label className="mt-2 flex items-center gap-2 text-[15px] text-site-ink">
          <input type="radio" name="display" checked={anonymous} onChange={() => setAnonymous(true)} />
          Anonymous (stage and industry only)
        </label>
        {crr ? (
          <label className="mt-3 flex items-center gap-2 text-[15px] text-site-ink">
            <input type="checkbox" checked={showScore} onChange={(e) => setShowScore(e.target.checked)} />
            Show my CRR score change
          </label>
        ) : null}
      </fieldset>

      <label className="mt-6 flex items-start gap-2 text-[14px] leading-6 text-site-muted">
        <input type="checkbox" className="mt-1.5" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (errors.consent) setErrors((x) => ({ ...x, consent: undefined })); }} />
        I agree iCapOS may publish this recommendation on icapos.com, shown the way I chose above.
      </label>
      {errors.consent ? <p className={fieldError}>{errors.consent}</p> : null}
      {errors.token ? <p className={fieldError}>{errors.token}</p> : null}
      {serverError ? <p className={fieldError}>{serverError}</p> : null}

      <button type="submit" disabled={state === "saving"}
        className="mt-6 rounded-lg bg-site-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">
        {state === "saving" ? "Sending…" : "Submit recommendation"}
      </button>
    </form>
  );
}
