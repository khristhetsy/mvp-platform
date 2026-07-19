"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { offeringTypeCopy, OPTION_ORDER, COUNSEL_INFO_URL } from "@/lib/onboarding/offering-type-copy";
import type { OfferingType } from "@/lib/onboarding/offering-type-schema";
import { saveOfferingType } from "./actions";

const BADGE: Record<string, string> = {
  public: "bg-[#E6F7F0] text-[#0E9F6E]",
  private: "bg-[#EEF1F7] text-[#47546E]",
  readiness: "bg-[#FFF6E6] text-[#B7791F]",
};
const CONFIRM: Record<string, string> = {
  green: "bg-[#E6F7F0] border-[#BEE8D6] text-[#0B5C41]",
  lock: "bg-[#EEF1F7] border-[#D6DDEA] text-[#2E3A54]",
  amber: "bg-[#FFF6E6] border-[#F3E0B6] text-[#7A5614]",
};

function ConfirmIcon({ variant }: { variant: string }) {
  if (variant === "green") {
    return (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#0E9F6E" />
        <path d="M6 10.2l2.6 2.6L14 7.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === "amber") {
    return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 15L8 9l3.5 3L17 5" stroke="#B7791F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 5H17v3.5" stroke="#B7791F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="8" rx="2" fill="#47546E" />
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="#47546E" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function OfferingTypeForm({ initialValue }: Readonly<{ initialValue: OfferingType | null }>) {
  const [selected, setSelected] = useState<OfferingType | null>(initialValue);
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function choose(value: OfferingType) {
    setSelected(value);
    setError(null);
  }

  function onKeyNav(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % OPTION_ORDER.length;
      cardRefs.current[next]?.focus();
      choose(OPTION_ORDER[next]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + OPTION_ORDER.length) % OPTION_ORDER.length;
      cardRefs.current[prev]?.focus();
      choose(OPTION_ORDER[prev]);
    }
  }

  function submit() {
    if (!selected || !attested) return;
    setError(null);
    startTransition(async () => {
      const res = await saveOfferingType({ offeringType: selected, attested: true });
      if (res?.error) setError(res.error);
    });
  }

  const confirm = selected ? offeringTypeCopy.confirmations[selected] : null;

  return (
    <div>
      {/* Options */}
      <div role="radiogroup" aria-label="Capital structure" className="flex flex-col gap-3">
        {OPTION_ORDER.map((value, idx) => {
          const opt = offeringTypeCopy.options[value];
          const isSel = selected === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSel}
              tabIndex={isSel || (!selected && idx === 0) ? 0 : -1}
              ref={(el) => { cardRefs.current[idx] = el; }}
              onClick={() => choose(value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(value); }
                else onKeyNav(e, idx);
              }}
              className={[
                "flex items-start gap-3.5 rounded-xl border-[1.5px] px-4 py-4 text-left transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A6CE4]",
                isSel ? "border-[#1A6CE4] bg-[#FBFDFF] shadow-[0_0_0_3px_rgba(26,108,228,.12)]" : "border-[#E3E8F2] bg-white hover:border-[#B9CFF3]",
              ].join(" ")}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${isSel ? "border-[#1A6CE4]" : "border-[#C4CEE0]"}`}
                aria-hidden="true"
              >
                <span className={`h-2.5 w-2.5 rounded-full bg-[#1A6CE4] transition-transform ${isSel ? "scale-100" : "scale-0"}`} />
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-[#16223F]">{opt.title}</span>
                  <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${BADGE[opt.badgeVariant]}`}>{opt.badge}</span>
                </span>
                <span className="mt-1 block text-[13px] leading-[1.5] text-[#5A6782]">{opt.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic confirmation panel */}
      <div aria-live="polite">
        {confirm ? (
          <div className={`mt-[18px] flex gap-3 rounded-[10px] border px-4 py-3.5 text-[13.5px] leading-[1.55] ${CONFIRM[confirm.variant]}`}>
            <span className="mt-0.5 shrink-0"><ConfirmIcon variant={confirm.variant} /></span>
            <span><strong className="font-semibold">{confirm.lead}</strong> {confirm.body}</span>
          </div>
        ) : null}
      </div>

      {/* Not sure expander */}
      <details className="mt-5 text-[13px]">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-medium text-[#1A6CE4] [&::-webkit-details-marker]:hidden">
          {offeringTypeCopy.notSure.summary} <span aria-hidden="true" className="text-[10px]">▼</span>
        </summary>
        <div className="mt-2.5 rounded-[10px] bg-[#F6F8FC] px-4 py-3.5 leading-[1.6] text-[#5A6782]">
          {offeringTypeCopy.notSure.items.map((it) => (
            <p key={it.term} className="mb-2 last:mb-0">
              <strong className="text-[#16223F]">{it.term}</strong> {it.body}
            </p>
          ))}
          <p className="mb-0">
            {offeringTypeCopy.notSure.counselPrefix}
            <Link href={COUNSEL_INFO_URL} className="text-[#1A6CE4] underline">
              {offeringTypeCopy.notSure.counselLinkText}
            </Link>
            {offeringTypeCopy.notSure.counselSuffix}
          </p>
        </div>
      </details>

      {/* Attestation */}
      <label className="mt-6 flex items-start gap-2.5 text-[13px] leading-[1.5] text-[#16223F]">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="mt-0.5 h-[17px] w-[17px] cursor-pointer accent-[#1A6CE4]"
        />
        <span>{offeringTypeCopy.attestation}</span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          {error}
        </p>
      ) : null}

      {/* CTA row */}
      <div className="mt-6 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={offeringTypeCopy.cta.backHref} className="text-center text-[13.5px] text-[#5A6782] hover:text-[#16223F] sm:text-left">
          {offeringTypeCopy.cta.back}
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={!selected || !attested || pending}
          className="rounded-[10px] bg-gradient-to-r from-[#0A1A40] to-[#1A6CE4] px-7 py-3 text-[14.5px] font-semibold text-white transition enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {pending ? offeringTypeCopy.cta.saving : offeringTypeCopy.cta.continue}
        </button>
      </div>
    </div>
  );
}
