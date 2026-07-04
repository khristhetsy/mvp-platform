// AI-drafted investor-review messages. Generates a short, professional message
// to an investor about the outcome of their profile review (approve / request
// changes / reject), grounded on their actual profile. Degrades gracefully to a
// template when Claude is not configured or the call fails.

import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";

export type ReviewAction = "approve" | "reject" | "changes_requested";

export interface ReviewMessageInput {
  action: ReviewAction;
  investorName: string;
  sectors?: string[] | null;
  stages?: string[] | null;
  geographies?: string[] | null;
  thesis?: string | null;
  /** Staff feedback to weave into a changes/reject message. */
  feedback?: string | null;
}

function firstName(name: string): string {
  const n = (name || "").trim().split(/\s+/)[0];
  return n || "there";
}

/** Deterministic template used when AI is unavailable. Compliance-safe wording. */
export function fallbackReviewMessage(input: ReviewMessageInput): string {
  const name = firstName(input.investorName);
  const focus = [
    (input.stages ?? []).join(", "),
    (input.sectors ?? []).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  if (input.action === "approve") {
    return [
      `Hi ${name},`,
      "",
      `Your investor profile on iCapOS has been approved and full workspace access is now enabled.${
        focus ? ` We'll surface opportunities aligned with your focus (${focus}) in your Private Market view.` : ""
      }`,
      "",
      "A member of our team will follow up shortly. Welcome aboard.",
    ].join("\n");
  }

  if (input.action === "changes_requested") {
    return [
      `Hi ${name},`,
      "",
      "Thanks for submitting your investor profile. Before we can complete your review, we need a few updates to your onboarding details.",
      input.feedback ? `\nWhat to update: ${input.feedback.trim()}` : "",
      "",
      "Once updated, resubmit and we'll take another look right away.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Hi ${name},`,
    "",
    "Thank you for your interest in iCapOS. After reviewing your submission, we're not able to approve your investor profile at this time.",
    input.feedback ? `\nContext: ${input.feedback.trim()}` : "",
    "",
    "We appreciate the time you took to apply and wish you the best.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(input: ReviewMessageInput): string {
  const facts = [
    `Investor name: ${input.investorName}`,
    input.sectors?.length ? `Preferred sectors: ${input.sectors.join(", ")}` : null,
    input.stages?.length ? `Preferred stages: ${input.stages.join(", ")}` : null,
    input.geographies?.length ? `Preferred geographies: ${input.geographies.join(", ")}` : null,
    input.thesis ? `Investment thesis: ${input.thesis}` : null,
    input.feedback ? `Staff feedback to convey: ${input.feedback}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const intent =
    input.action === "approve"
      ? "The investor's profile was APPROVED. Warmly welcome them, note that full workspace access is now enabled, and reference their focus if relevant."
      : input.action === "changes_requested"
        ? "The investor is being asked to REVISE their onboarding. Politely explain that a few updates are needed before approval, incorporating the staff feedback, and invite them to resubmit."
        : "The investor's profile was DECLINED. Politely and respectfully decline, incorporating the staff feedback if provided, without being discouraging.";

  return [
    intent,
    "",
    "Investor profile:",
    facts,
    "",
    "Write the message body only (no subject line, no signature block).",
  ].join("\n");
}

/**
 * Generate a review message. Returns { message, ai } where ai=false means the
 * template fallback was used (Claude unavailable or errored).
 */
export async function generateReviewMessage(
  input: ReviewMessageInput,
): Promise<{ message: string; ai: boolean }> {
  if (!isClaudeConfigured()) {
    return { message: fallbackReviewMessage(input), ai: false };
  }

  const system = [
    "You are an investor relations associate at iCapOS, a private-market operating platform.",
    "Write a short (3-5 sentences), warm but professional message to an investor about their profile review outcome.",
    "Plain text only: no markdown, no emojis, no subject line, no signature block.",
    "Do not invent facts beyond those provided. Never use the terms 'SPV' or 'broker-dealer'. Refer to deals as the 'Private Market' and to interest as 'indicated interest'.",
    "Start with a greeting using the investor's first name.",
  ].join(" ");

  try {
    const text = await claudeComplete([{ role: "user", content: buildPrompt(input) }], {
      model: CLAUDE_HAIKU,
      maxTokens: 400,
      temperature: 0.6,
      system,
    });
    const message = text?.trim();
    if (!message) return { message: fallbackReviewMessage(input), ai: false };
    return { message, ai: true };
  } catch {
    return { message: fallbackReviewMessage(input), ai: false };
  }
}

/** Email subject line for a review decision. */
export function reviewMessageSubject(action: ReviewAction): string {
  if (action === "approve") return "Your iCapOS investor profile is approved";
  if (action === "changes_requested") return "A quick update needed on your iCapOS profile";
  return "Update on your iCapOS investor application";
}
