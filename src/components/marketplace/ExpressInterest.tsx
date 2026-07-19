"use client";

import { useId, useState, useTransition } from "react";
import { marketplaceCopy } from "@/lib/marketplace/copy";
import { expressInterestSchema } from "@/lib/marketplace/express-interest-schema";
import { submitExpressInterest } from "@/app/marketplace/actions";

const C = marketplaceCopy;

function capture(event: string, props?: Record<string, unknown>) {
  try {
    (window as unknown as { posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void } }).posthog?.capture?.(event, props);
  } catch {
    /* analytics best-effort */
  }
}

/**
 * Actions row (outbound portal link + express-interest toggle) plus the inline,
 * non-binding express-interest form. Client component per the spec; the parent
 * ListingCard stays a server component. SSR-rendered so the portal link is in
 * the initial HTML.
 */
export function ExpressInterest({
  listingId,
  portalName,
  portalUrl,
  defaultOpen = false,
}: Readonly<{ listingId: string; portalName: string; portalUrl: string; defaultOpen?: boolean }>) {
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formId = useId();

  function onSubmit(formData: FormData) {
    const input = {
      listingId,
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      intendedAmount: String(formData.get("intendedAmount") ?? ""),
      website: String(formData.get("website") ?? ""),
    };
    const parsed = expressInterestSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? C.expressInterest.genericError);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitExpressInterest(parsed.data);
      if (res.ok) {
        capture("marketplace_interest_submitted", { listingId });
        setDone(true);
      } else {
        setError(res.error ?? C.expressInterest.genericError);
      }
    });
  }

  return (
    <div>
      <div className="mt-0.5 flex gap-2.5">
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener nofollow external"
          onClick={() => capture("marketplace_portal_clicked", { listingId })}
          className="flex-1 rounded-[9px] bg-[linear-gradient(90deg,#0A1A40,#1A6CE4)] px-3.5 py-2.5 text-center text-[13px] font-semibold text-white transition hover:-translate-y-px"
        >
          {C.card.portalCtaPrefix}
          {portalName}
          {C.card.portalCtaSuffix}
          <span className="sr-only"> {C.card.opensNewTab}</span>
        </a>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen((v) => !v)}
          className="flex-1 rounded-[9px] border-[1.5px] border-[#1A6CE4] bg-white px-3.5 py-2.5 text-center text-[13px] font-semibold text-[#1A6CE4] transition hover:-translate-y-px"
        >
          {C.card.expressInterest}
        </button>
      </div>

      {open ? (
        <div id={formId} className="mt-3 rounded-[10px] border border-[#C9DCF9] bg-[#EAF1FD] p-3.5">
          {done ? (
            <p role="status" className="py-1.5 text-center text-[12.5px] font-semibold text-[#0E9F6E]">
              {C.expressInterest.success}
            </p>
          ) : (
            <form action={onSubmit}>
              {/* Rule 206 disclaimer renders first, above the inputs, always visible. */}
              <div className="mb-2.5 rounded-lg border border-[#D8E5FA] bg-white px-2.5 py-2 text-[10.5px] leading-[1.5] text-[#1F3A66]">
                <strong>{C.expressInterest.rule206Lead}</strong> {C.expressInterest.rule206Body}
              </div>
              <input
                name="fullName"
                type="text"
                required
                aria-label={C.expressInterest.nameLabel}
                placeholder={C.expressInterest.nameLabel}
                className="mb-2 w-full rounded-lg border border-[#C4CEE0] px-2.5 py-2 text-[12.5px] focus:border-[#1A6CE4] focus:outline focus:outline-2 focus:outline-[#1A6CE4]"
              />
              <input
                name="email"
                type="email"
                required
                aria-label={C.expressInterest.emailLabel}
                placeholder={C.expressInterest.emailLabel}
                className="mb-2 w-full rounded-lg border border-[#C4CEE0] px-2.5 py-2 text-[12.5px] focus:border-[#1A6CE4] focus:outline focus:outline-2 focus:outline-[#1A6CE4]"
              />
              <input
                name="intendedAmount"
                type="text"
                aria-label={C.expressInterest.amountLabel}
                placeholder={C.expressInterest.amountLabel}
                className="w-full rounded-lg border border-[#C4CEE0] px-2.5 py-2 text-[12.5px] focus:border-[#1A6CE4] focus:outline focus:outline-2 focus:outline-[#1A6CE4]"
              />
              <p className="mb-2 mt-1 text-[10.5px] text-[#5A6782]">{C.expressInterest.amountNote}</p>
              {/* Honeypot — visually hidden, bots fill it. */}
              <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />
              {error ? <p className="mb-2 text-[11.5px] text-rose-700">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-[9px] bg-[linear-gradient(90deg,#0A1A40,#1A6CE4)] px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {pending ? C.expressInterest.submitting : C.expressInterest.submit}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
