// Prospect Pipeline — Step 3 (AI Approach) advice view.
// Deterministic advice derived from the stored `approach` jsonb + contact fields.
// No new AI generation and no invented specifics — it summarizes what the approach
// model already computed, plus a constant compliance watch-out from the lexicon.

export interface ApproachAdvice {
  angle: string;
  channel: string;
  nextStep: string;
  hook: string | null;
  watchOuts: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Approach = any;

const CHANNEL_LABEL: Record<string, string> = {
  email: "Warm email → LinkedIn follow-up",
  email_then_call: "Email first, then a call",
};

const NEXT_STEP: Record<string, string> = {
  hot: "Prioritize outreach this week",
  warm: "Add to a nurture sequence",
  cold: "Long-nurture — re-engage later",
};

const WATCH_OUTS = "Private-market language only — indicated interest, no funding-outcome claims.";

export function buildApproachAdvice(input: {
  side: string | null;
  segment: string | null;
  approach: Approach | null;
}): ApproachAdvice {
  const a = (input.approach ?? {}) as Record<string, unknown>;
  const seg = input.segment ?? "cold";
  const isFounder = input.side === "founder";

  const angleBase = isFounder
    ? "Lead with readiness & traction"
    : "Lead with on-thesis, curated access";
  const segTone = seg === "hot" ? "high-fit, move fast" : seg === "warm" ? "warming — build the case" : "early — nurture";
  const angle = `${angleBase} (${segTone})`;

  const channelKey = typeof a.channel === "string" ? a.channel : "email";
  const channel = CHANNEL_LABEL[channelKey] ?? CHANNEL_LABEL.email;

  const timing = typeof a.timing === "string" && a.timing ? a.timing : "";
  const nextStep = timing ? `${NEXT_STEP[seg] ?? NEXT_STEP.cold} · ${timing}` : (NEXT_STEP[seg] ?? NEXT_STEP.cold);

  const hook = typeof a.hook === "string" && a.hook ? a.hook : null;

  return { angle, channel, nextStep, hook, watchOuts: WATCH_OUTS };
}
