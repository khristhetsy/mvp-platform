"use client";

// Shared anonymized match-card list for the founder + investor Matching Centers.
// Identity is withheld; only fit score, coarse descriptors, and reason chips show.
// Founder cards may carry an opaque `introRef` + `introEndpoint` to request a
// brokered introduction without revealing the investor's identity.
import { useState } from "react";
import { InvestorDetailModal, type InvestorDetail } from "@/components/founder/InvestorDetailModal";
import { FounderToolbar, applySearch } from "@/components/founder/FounderToolbar";
import { EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";

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
  /** Where the founder's own introduction request stands. Absent or null = none sent. */
  introStatus?: "reviewing" | "introduced" | "declined" | null;
  /** iCFO's note on a declined request. */
  introNote?: string | null;
  /** Data used to create the founder-CRM lead on "Add to follow-up". */
  followUp?: { name: string; firm: string | null; investorType: string | null };
};

function barColor(score: number): string {
  if (score >= 70) return "#17a06a";
  if (score >= 45) return "#5b8def";
  return "#cbd5e1";
}

/**
 * The introduction gate, on the button itself.
 *
 * The engine has always refused to broker below the rating gate; the button
 * did not know, so a founder at 51 could ask and be silently declined. Locked
 * and legible beats live and futile.
 */
function IntroLocked({ gate, score }: { gate: number; score: number | null }) {
  return (
    <span
      className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400"
      title={score === null
        ? `Introductions open once your Capital Readiness Rating reaches ${gate}.`
        : `Your CRR is ${score}. Introductions open at ${gate}.`}
    >
      Locked until CRR {gate}
    </span>
  );
}

/** The founder's request, once sent: iCFO reviewing, introduced, or declined with iCFO's note. */
function IntroStatusPill({ status, note }: { status: "reviewing" | "introduced" | "declined"; note?: string | null }) {
  if (status === "introduced") {
    return <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><i className="ti ti-check" aria-hidden="true" /> Introduced</span>;
  }
  if (status === "declined") {
    return (
      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600" title={note || "iCFO declined this introduction."}>
        Declined{note ? ` · ${note.length > 60 ? `${note.slice(0, 60)}…` : note}` : ""}
      </span>
    );
  }
  return <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"><i className="ti ti-clock" aria-hidden="true" /> iCFO reviewing</span>;
}

function IntroButton({ introRef, endpoint }: { introRef: string; endpoint: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function request() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: introRef }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      // Show why (plan limit, plan required, gate) instead of a bare retry.
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? null);
      setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <IntroStatusPill status="reviewing" />;
  if (state === "error" && message) {
    return <span className="max-w-[16rem] text-[11px] leading-snug text-amber-800">{message}</span>;
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
  if (state === "done") return <span className="text-xs font-medium text-emerald-600">Added to follow-up <i className="ti ti-check" aria-hidden="true" /></span>;

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
  scope,
  gate,
}: {
  cards: MatchCenterCard[];
  emptyText: string;
  introEndpoint?: string;
  followUpEndpoint?: string;
  draftEndpoint?: string;
  /** Saved-views key. Omit on the investor side, which has no founder toolbar. */
  scope?: string;
  /** The CRR gate. Omitted on the investor side, which has no rating to hold. */
  gate?: { score: number | null; gate: number; unlocked: boolean };
}) {
  const [selected, setSelected] = useState<MatchCenterCard | null>(null);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [view, setView] = useState<"list" | "cards">("list");

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  const visible = applySearch(cards, search, {
    text: (c) => `${c.title} ${c.subtitle ?? ""} ${c.tag} ${c.reasons.join(" ")}`,
    quick: {
      fit90: (c) => c.matchScore >= 90,
      fit70: (c) => c.matchScore >= 70,
      fit45: (c) => c.matchScore >= 45,
      connected: (c) => !!c.connected,
      not_connected: (c) => !c.connected,
      can_intro: (c) => !!c.introRef,
    },
    field: {
      type: (c) => c.tag,
      reason: (c) => c.reasons,
    },
  });

  return (
    <>
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <FounderToolbar
        scope={scope ?? "matches"}
        state={search}
        onChange={setSearch}
        count={visible.length}
        countLabel="matches"
        placeholder="Search matches — type, sector, reason…"
        quick={[
          { key: "fit90", label: "Fit ≥ 90" },
          { key: "fit70", label: "Fit ≥ 70" },
          { key: "fit45", label: "Fit ≥ 45" },
          { key: "connected", label: "Introduced", sep: true },
          { key: "not_connected", label: "Not yet introduced" },
          { key: "can_intro", label: "Intro available" },
        ]}
        fields={[
          { key: "type", label: "Investor type", options: [...new Set(cards.map((c) => c.tag).filter(Boolean))] },
          { key: "reason", label: "Match reason", options: [...new Set(cards.flatMap((c) => c.reasons))].slice(0, 40) },
        ]}
        groups={[
          { id: "none", label: "None" },
          { id: "type", label: "Investor type" },
          { id: "fit", label: "Fit band" },
        ]}
        right={
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            {(["list", "cards"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${view === m ? "bg-[var(--brand-indigo,#2E78F5)] text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {m}
              </button>
            ))}
          </div>
        }
      />
    </div>
    {visible.length === 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No matches for that search.
      </div>
    ) : view === "list" ? (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.7fr_1fr_1.6fr_64px_1.5fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400 sm:grid">
          <span>Investor</span><span>Type</span><span>Match reasons</span><span className="text-center">Match</span><span className="text-right">Actions</span>
        </div>
        {visible.map((c, i) => {
          const label = (c.subtitle ?? "").split(" · ")[0] || c.subtitle || "";
          return (
            <div
              key={i}
              onClick={c.detail ? () => setSelected(c) : undefined}
              role={c.detail ? "button" : undefined}
              tabIndex={c.detail ? 0 : undefined}
              onKeyDown={c.detail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c); } } : undefined}
              className={`grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1.7fr_1fr_1.6fr_64px_1.5fr] sm:items-center sm:gap-3 ${c.detail ? "cursor-pointer transition-colors hover:bg-slate-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-900">
                  {c.title}
                  <span className="flex-none rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">{c.tag}</span>
                </p>
                {c.subtitle && <p className="truncate text-[11px] text-slate-500 sm:hidden">{c.subtitle}</p>}
              </div>
              <span className="text-[12px] text-slate-600">{label || "—"}</span>
              <div className="flex flex-wrap gap-1.5">
                {c.reasons.slice(0, 3).map((r) => (
                  <span key={r} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{r}</span>
                ))}
                {c.reasons.length > 3 && <span className="rounded-full border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-[var(--brand-indigo,#2E78F5)]">+{c.reasons.length - 3}</span>}
              </div>
              <span className="text-[15px] font-semibold sm:text-center" style={{ color: barColor(c.matchScore) }}>{c.matchScore}</span>
              {(introEndpoint || followUpEndpoint) ? (
                <div className="flex items-center gap-2 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                  {followUpEndpoint && c.followUp && <FollowUpButton card={c} endpoint={followUpEndpoint} />}
                  {introEndpoint && c.introRef && (
                    c.introStatus
                      ? <IntroStatusPill status={c.introStatus} note={c.introNote} />
                      : gate && !gate.unlocked
                      ? <IntroLocked gate={gate.gate} score={gate.score} />
                      : <IntroButton introRef={c.introRef} endpoint={introEndpoint} />
                  )}
                </div>
              ) : <span />}
            </div>
          );
        })}
      </div>
    ) : (
    <div className="space-y-4">
      {visible.map((c, i) => (
        <div
          key={i}
          onClick={c.detail ? () => setSelected(c) : undefined}
          role={c.detail ? "button" : undefined}
          tabIndex={c.detail ? 0 : undefined}
          onKeyDown={c.detail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c); } } : undefined}
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
              {introEndpoint && c.introRef && (
                c.introStatus
                  ? <IntroStatusPill status={c.introStatus} note={c.introNote} />
                  : gate && !gate.unlocked
                  ? <IntroLocked gate={gate.gate} score={gate.score} />
                  : <IntroButton introRef={c.introRef} endpoint={introEndpoint} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
    )}
    {selected?.detail && (
      <InvestorDetailModal
        detail={selected.detail}
        onClose={() => setSelected(null)}
        draftEndpoint={draftEndpoint}
        introEndpoint={introEndpoint}
        introRef={selected.introRef}
      />
    )}
    </>
  );
}
