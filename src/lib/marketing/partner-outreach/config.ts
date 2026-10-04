/**
 * Partner outreach sequences: pure rules (no database). The store and API call
 * these; the editor imports the labels.
 *
 * Four fixed steps per partner: Day 1 email, Day 4 call or LinkedIn task,
 * Day 10 follow up with the partner rate sheet, Day 21 close the loop. Every
 * send is released by a person from the sequence page (nothing auto sends),
 * and a partner stops getting steps once they reply, book a call, start a
 * pilot, sign, unsubscribe, or are stopped by hand.
 */

export type PartnerTier = 1 | 2 | 3 | 4;
export type PartnerTrack = "advisor" | "professional" | "angel_group" | "accelerator" | "bank";
export type PartnerRating = "strong" | "check";
export type PartnerStage = "enrolled" | "replied" | "call_booked" | "pilot" | "signed" | "stopped";

export const TIER_LABEL: Record<PartnerTier, string> = {
  1: "Tier 1 · Capital advisors",
  2: "Tier 2 · CFOs, CPAs, attorneys",
  3: "Tier 3 · Accelerators, angel groups",
  4: "Tier 4 · Banks, portals",
};

export const TRACK_LABEL: Record<PartnerTrack, string> = {
  advisor: "Capital advisor",
  professional: "CFO, CPA or attorney",
  angel_group: "Angel group",
  accelerator: "Accelerator or incubator",
  bank: "Bank, broker or portal",
};

/** Default track for a tier, used when a partner is added without one. */
export const TIER_DEFAULT_TRACK: Record<PartnerTier, PartnerTrack> = {
  1: "advisor", 2: "professional", 3: "accelerator", 4: "bank",
};

export const STAGES: readonly { key: PartnerStage; label: string }[] = [
  { key: "enrolled", label: "Enrolled" },
  { key: "replied", label: "Replied" },
  { key: "call_booked", label: "Call booked" },
  { key: "pilot", label: "Pilot" },
  { key: "signed", label: "Signed" },
  { key: "stopped", label: "Stopped" },
];

/** Stages that stop further steps. */
export function stageStopsSteps(stage: PartnerStage): boolean {
  return stage !== "enrolled";
}

export type PartnerStepKey = "d1" | "d4" | "d10" | "d21";
export type PartnerStep = {
  key: PartnerStepKey;
  channel: "email" | "task";
  /** Days after the partner's start (Day 1 = 0). */
  offsetDays: number;
  label: string;
};

export const PARTNER_STEPS: readonly PartnerStep[] = [
  { key: "d1", channel: "email", offsetDays: 0, label: "Day 1 · email" },
  { key: "d4", channel: "task", offsetDays: 3, label: "Day 4 · LinkedIn or call" },
  { key: "d10", channel: "email", offsetDays: 9, label: "Day 10 · follow up with rate sheet" },
  { key: "d21", channel: "email", offsetDays: 20, label: "Day 21 · close the loop" },
];

const DAY = 24 * 60 * 60 * 1000;

/** When step `index` is due for a partner who started at `startedAt`; null once finished. */
export function stepDueAt(startedAt: Date, index: number): Date | null {
  const step = PARTNER_STEPS[index];
  return step ? new Date(startedAt.getTime() + step.offsetDays * DAY) : null;
}

export type PartnerOffer = {
  /** Recurring share of each referred subscription, percent. */
  share_pct: number | null;
  /** Wholesale price for white label resale, as written (e.g. "$29 per seat per month"). */
  white_label_price: string | null;
  /** Flat fee per signed iCFO Capital SPV engagement, dollars. */
  spv_fee: number | null;
  /** Securities counsel confirmed the SPV referral fee. */
  counsel_signed_off: boolean;
};

export type PartnerSender = { from_name: string; from_email: string; reply_to: string };

export type PartnerConfig = { offer: PartnerOffer; sender: PartnerSender };

export const EMPTY_OFFER: PartnerOffer = { share_pct: null, white_label_price: null, spv_fee: null, counsel_signed_off: false };

/** Read a stored partner_config jsonb, filling anything missing. */
export function readConfig(raw: unknown, defaults: PartnerSender): PartnerConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as { offer?: Partial<PartnerOffer>; sender?: Partial<PartnerSender> };
  const o = r.offer ?? {};
  const s = r.sender ?? {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    offer: {
      share_pct: num(o.share_pct),
      white_label_price: str(o.white_label_price),
      spv_fee: num(o.spv_fee),
      counsel_signed_off: o.counsel_signed_off === true,
    },
    sender: {
      from_name: str(s.from_name) ?? defaults.from_name,
      from_email: str(s.from_email) ?? defaults.from_email,
      reply_to: str(s.reply_to) ?? defaults.reply_to,
    },
  };
}

/** What still blocks activation; empty when the sequence can go live. */
export function activationBlockers(config: PartnerConfig): string[] {
  const out: string[] = [];
  if (config.offer.share_pct == null || config.offer.share_pct <= 0 || config.offer.share_pct > 100) out.push("Set the subscription share (1 to 100%).");
  if (!config.offer.white_label_price) out.push("Set the white label price.");
  if (config.offer.spv_fee == null || config.offer.spv_fee <= 0) out.push("Set the SPV referral fee.");
  if (!config.offer.counsel_signed_off) out.push("Confirm counsel signed off on the SPV referral fee.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.sender.from_email)) out.push("Set a valid sender email.");
  return out;
}

export function formatShare(pct: number | null): string {
  return pct == null ? "" : `${Math.round(pct * 100) / 100}%`;
}

export function formatFee(dollars: number | null): string {
  return dollars == null ? "" : `$${Math.round(dollars).toLocaleString("en-US")}`;
}

// ── Email text ──────────────────────────────────────────────────────────────

export type EmailParts = { subject: string; body: string };

type Recipient = { name: string; firm: string | null; track: PartnerTrack; subject?: string | null; body?: string | null };

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  // Records named after an inbox ("info@...") have no usable first name.
  return first && !first.includes("@") ? first : "there";
}

const SIGNATURE = "Best,\nKhris Thetsy\nFounder & CEO, iCFO Capital Global, Inc.";
const FIT = "icapos.com/fit";

function firmOr(r: Recipient, fallback: string): string {
  return r.firm && r.firm !== r.name && !r.firm.includes("@") ? r.firm : fallback;
}

/** Standard Day 1 email per track, used when a partner has no personal draft. */
export function standardDay1(r: Recipient): EmailParts {
  const fn = firstName(r.name);
  const firm = firmOr(r, "your firm");
  switch (r.track) {
    case "advisor":
      return {
        subject: "A capital raising partnership that pays both sides",
        body: [`Hi ${fn},`,
          `${firm} helps companies raise capital. I would like to propose a partnership that makes money for both of us.`,
          `You could offer iCapOS, our capital readiness and investor matching platform, to your clients under your own brand and at your own price. When a client needs a full raise structured, you refer them to iCFO Capital's SPV program and earn a flat fee when they sign.`,
          `It also lowers your cost per client. iCapOS handles the diligence report, valuation, financial model, data room and matching against 7,000+ investor contacts.`,
          `See it on any company at ${FIT}. Open to 20 minutes next week?`, SIGNATURE].join("\n\n"),
      };
    case "professional":
      return {
        subject: "A recurring revenue line from clients who are raising",
        body: [`Hi ${fn},`,
          `Your clients often ask you first when they start thinking about outside capital. I would like that question to earn you money.`,
          `Refer a client to iCapOS and you earn a recurring share of their subscription, where your professional rules allow it. For $49 a month they get the cap table, financial model, valuation, data room and matching to 7,000+ investor contacts, which is prep work you no longer build by hand.`,
          `Our funded founders also need CFOs, accountants and counsel, and we would send that work to you.`,
          `Any client can see their matches at ${FIT}. Worth a 20 minute call?`, SIGNATURE].join("\n\n"),
      };
    case "angel_group":
      return {
        subject: `Earning on the founders ${firm === "your firm" ? "your group" : firm} passes on`,
        body: [`Hi ${fn},`,
          `Every angel group passes on far more founders than it funds. Those founders could earn the group money instead of leaving with nothing.`,
          `Send them to iCapOS and the group earns a recurring share of each subscription. The founders get readiness tools and matching to 7,000+ investor contacts, and your members can watch for the ones that mature.`,
          `The investor side is free and cuts screening time, with a deal directory, data rooms and diligence reports for each company your members review.`,
          `See it at ${FIT}. Open to a 20 minute call?`, SIGNATURE].join("\n\n"),
      };
    case "accelerator":
      return {
        subject: "A capital readiness program you can sell under your brand",
        body: [`Hi ${fn},`,
          `${firm === "your firm" ? "Your program" : firm} gets founders moving. iCapOS lets you sell the next step, getting investor ready, as a program of your own.`,
          `Run it under your name at your price. iCapOS supplies the readiness rating, eLearning, pitch practice, valuation, data room and matching to 7,000+ investor contacts. You keep the margin and skip building the curriculum.`,
          `Would a pilot with your next cohort be useful? Founders can preview it at ${FIT}.`, SIGNATURE].join("\n\n"),
      };
    case "bank":
      return {
        subject: "Getting paid on the companies you turn away",
        body: [`Hi ${fn},`,
          `Companies too small or too early for ${firm} earn you nothing today.`,
          `Send them to iCapOS and you earn a recurring share of their subscription. They build their diligence report, valuation, financial model and data room on the platform, then come back to you prepared, which cuts your screening and onboarding time.`,
          `Open to a 20 minute call to agree on a size threshold and terms?`, SIGNATURE].join("\n\n"),
      };
  }
}

export function day1Email(r: Recipient): EmailParts {
  if (r.subject?.trim() && r.body?.trim()) return { subject: r.subject.trim(), body: r.body.trim() };
  return standardDay1(r);
}

/** Day 10 follow up: the partner rate sheet, by track. */
export function day10Email(r: Recipient, offer: PartnerOffer): EmailParts {
  const fn = firstName(r.name);
  const lines: string[] = [];
  const share = formatShare(offer.share_pct);
  const fee = formatFee(offer.spv_fee);
  if (r.track === "advisor" || r.track === "accelerator") {
    lines.push(`White label: iCapOS under your brand at ${offer.white_label_price}, and you set your client price.`);
    lines.push(`SPV referrals: ${fee} flat when a company you refer signs an iCFO Capital SPV engagement. Paid at signing, never tied to money raised.`);
    lines.push(`Subscription share: ${share} of every subscription you refer, for as long as the client stays.`);
  } else if (r.track === "professional") {
    lines.push(`Subscription share: ${share} of every subscription you refer, for as long as the client stays, where your professional rules allow it.`);
    lines.push(`Work back: we refer our funded founders who need finance, accounting or legal help.`);
  } else {
    lines.push(`Subscription share: ${share} of every subscription you refer, for as long as the company stays.`);
    lines.push(r.track === "angel_group"
      ? `Free investor accounts for your members, with screened deal flow.`
      : `Companies that grow come back to you prepared.`);
  }
  return {
    subject: "Partner terms, in one place",
    body: [`Hi ${fn},`,
      `Following up on my note about partnering with iCFO Capital Global. Here are the terms in one place:`,
      lines.map((l) => `• ${l}`).join("\n"),
      `Any founder can see their best fit investor firms at ${FIT}. Would 20 minutes this week or next work?`, SIGNATURE].join("\n\n"),
  };
}

/** Day 21: close the loop. */
export function day21Email(r: Recipient): EmailParts {
  const fn = firstName(r.name);
  return {
    subject: "Closing the loop",
    body: [`Hi ${fn},`,
      `I have not heard back, so I will assume the timing is not right and stop writing.`,
      `If partnering with iCFO Capital Global becomes useful later, reply to this email and we can pick it up. The offer and ${FIT} stay open.`,
      SIGNATURE].join("\n\n"),
  };
}

/** Email for step `index`, or null for a task step. */
export function emailForStep(index: number, r: Recipient, offer: PartnerOffer): EmailParts | null {
  const step = PARTNER_STEPS[index];
  if (!step || step.channel !== "email") return null;
  if (step.key === "d1") return day1Email(r);
  if (step.key === "d10") return day10Email(r, offer);
  return day21Email(r);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text body to simple HTML paragraphs, with the /fit link made clickable. */
export function bodyToHtml(body: string): string {
  return body.split(/\n{2,}/).map((para) => {
    const html = esc(para).replace(/\n/g, "<br>").replace(/icapos\.com\/fit/g, '<a href="https://icapos.com/fit">icapos.com/fit</a>');
    return `<p style="margin:0 0 14px;line-height:1.55;">${html}</p>`;
  }).join("\n");
}

/** Pipeline counts by stage. */
export function stageCounts(rows: { stage: PartnerStage }[]): Record<PartnerStage, number> {
  const out = { enrolled: 0, replied: 0, call_booked: 0, pilot: 0, signed: 0, stopped: 0 } as Record<PartnerStage, number>;
  for (const r of rows) out[r.stage] = (out[r.stage] ?? 0) + 1;
  return out;
}
