"use client";

// Shared anonymized match-card list for the founder + investor Matching Centers.
// Identity is withheld; only fit score, coarse descriptors, and reason chips show.
// Founder cards may carry an opaque `introRef` + `introEndpoint` to request a
// brokered introduction without revealing the investor's identity.
import { useState } from "react";
import { InvestorDetailModal, type InvestorDetail } from "@/components/founder/InvestorDetailModal";

export type MatchCenterCard = {
  matchScore: number;
  tag: string;
  title: string;
  subtitle: string | null;
  reasons: string[];
  introRef?: string;
  /** When present, clicking the card opens the anonymized detail panel. */
  detail?: InvestorDetail;
  /** True once an intro has been facilitated — enables the Follow-up action. */
  connected?: boolean;
  /** Data used to create the founder-CRM lead on "Add to follow-up". */
  followUp?: { name: string; firm: string | null; investorType: string | null };
};

function barColor(score: number): string {
  if (score >= 70) return "#17a06a";
  if (score >= 45) return "#5b8def";
  return "#cbd5e1";
}

function IntroButton({ introRef, endpoint }: { introRef: string; endpoint: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function request() {
    setState("loading");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: introRef }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-xs font-medium text-emerald-600">Requested — the iCapOS team will follow up.</span>;
  }
  return (
    <button
      type="button"
      onClick={request}
      disabled={state === "loading"}
      className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
    >
      {state === "loading" ? "Requesting…" : state === "error" ? "Retry request" : "Request introduction"}
    </button>
  );
}

/** Follow-up is gated: green + active only when the investor is connected (an
 *  intro has been facilitated). Otherwise it's muted and clicking shows a note. */
function FollowUpButton({ card, endpoint }: { card: MatchCenterCard; endpoint: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showNote, setShowNote] = useState(false);

  if (!card.connected) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
          title="Follow-up unlocks once you're connected"
        >
          Follow-up
        </button>
        {showNote && (
          <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-left text-[11px] leading-4 text-amber-800 shadow-sm">
            <b>Follow-up unlocks once you&apos;re connected.</b> Request an introduction first — after {card.title} accepts, you can track and follow up here.
          </div>
        )}
      </div>
    );
  }
  if (state === "done") return <span className="text-xs font-medium text-emerald-600">Added to follow-up ✓</span>;

  async function add() {
    if (!card.followUp) return;
    setState("loading");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card.followUp) });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <button
      type="button"
      onClick={add}
      disabled={state === "loading"}
      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
    >
      {state === "loading" ? "Adding…" : state === "error" ? "Retry" : "Follow-up"}
    </button>
  );
}

export function MatchingCenterList({
  cards,
  emptyText,
  introEndpoint,
  followUpEndpoint,
  draftEndpoint,
}: {
  cards: MatchCenterCard[];
  emptyText: string;
  introEndpoint?: string;
  followUpEndpoint?: string;
  draftEndpoint?: string;
}) {
  const [selected, setSelected] = useState<InvestorDetail | null>(null);
  const [q, setQ] = useState("");
  const [minMatch, setMinMatch] = useState(0);

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  const query = q.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (c.matchScore < minMatch) return false;
    if (!query) return true;
    return `${c.title} ${c.subtitle ?? ""} ${c.tag} ${c.reasons.join(" ")}`.toLowerCase().includes(query);
  });
  const FILTERS: [string, number][] = [["All", 0], ["≥ 70%", 70], ["≥ 90%", 90]];

  return (
    <>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <i className="ti ti-search text-slate-400" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search matches — type, sector, reason…"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          aria-label="Search matches"
        />
      </div>
      {FILTERS.map(([label, v]) => (
        <button
          key={label}
          type="button"
          onClick={() => setMinMatch(v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${minMatch === v ? "border-[var(--brand-indigo,#2E78F5)] bg-indigo-50 text-[var(--brand-indigo,#2E78F5)]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          {label}
        </button>
      ))}
    </div>
    <div className="space-y-4">
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No matches for that search.
        </div>
      ) : visible.map((c, i) => (
        <div
          key={i}
          onClick={c.detail ? () => setSelected(c.detail!) : undefined}
          role={c.detail ? "button" : undefined}
          tabIndex={c.detail ? 0 : undefined}
          onKeyDown={c.detail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.detail!); } } : undefined}
          className={`rounded-2xl border border-slate-200 bg-white p-5 ${c.detail ? "cursor-pointer transition-colors hover:border-[var(--brand-indigo,#2E78F5)]" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {c.matchScore}% match
              </span>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900">{c.title}</p>
              {c.subtitle && <p className="text-xs text-slate-500">{c.subtitle}</p>}
            </div>
            <span className="flex-none rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {c.tag}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(c.matchScore, 3)}%`, background: barColor(c.matchScore) }} />
          </div>

          {c.reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.reasons.map((r) => (
                <span key={r} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                  {r}
                </span>
              ))}
            </div>
          )}

          {(introEndpoint || followUpEndpoint) && (
            <div className="mt-4 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              {followUpEndpoint && c.followUp && <FollowUpButton card={c} endpoint={followUpEndpoint} />}
              {introEndpoint && c.introRef && <IntroButton introRef={c.introRef} endpoint={introEndpoint} />}
            </div>
          )}
        </div>
      ))}
    </div>
    {selected && <InvestorDetailModal detail={selected} onClose={() => setSelected(null)} draftEndpoint={draftEndpoint} />}
    </>
  );
}
