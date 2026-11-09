// Approved wording for LinkedIn campaigns. Investor outreach is regulated, so nothing sends
// unless a person approved the exact text. Changing any word clears the approval.
import { createHash } from "node:crypto";

import { INVITE_NOTE_LIMIT, MAX_VARIANTS, MESSAGE_LIMIT } from "./limits";

export { INVITE_NOTE_LIMIT, MAX_VARIANTS, MESSAGE_LIMIT };

export type InviteVariant = { id: string; text: string };

export type WordingProblem = { field: string; message: string };

/** Problems that stop wording from being approved. An empty list means it can be approved. */
export function checkWording(variants: InviteVariant[], message: string | null | undefined, connectedMessage?: string | null): WordingProblem[] {
  const out: WordingProblem[] = [];
  if (variants.length === 0) out.push({ field: "invite_variants", message: "Add at least one invite version." });
  if (variants.length > MAX_VARIANTS) out.push({ field: "invite_variants", message: `Use at most ${MAX_VARIANTS} invite versions.` });
  const seen = new Set<string>();
  for (const v of variants) {
    const text = v.text.trim();
    if (!text) out.push({ field: `invite_variants.${v.id}`, message: "An invite version is empty." });
    if (text.length > INVITE_NOTE_LIMIT) out.push({ field: `invite_variants.${v.id}`, message: `An invite version is over ${INVITE_NOTE_LIMIT} characters.` });
    if (seen.has(text.toLowerCase())) out.push({ field: `invite_variants.${v.id}`, message: "Two invite versions are identical." });
    seen.add(text.toLowerCase());
  }
  const m = (message ?? "").trim();
  if (!m) out.push({ field: "message_text", message: "Add the message sent after someone accepts." });
  if (m.length > MESSAGE_LIMIT) out.push({ field: "message_text", message: `The message is over ${MESSAGE_LIMIT} characters.` });
  // Optional. Without it, people who are already connected are simply not messaged.
  if ((connectedMessage ?? "").trim().length > MESSAGE_LIMIT) out.push({ field: "connected_message_text", message: `The message for existing connections is over ${MESSAGE_LIMIT} characters.` });
  return out;
}

/** A campaign that reads your own LinkedIn connections sends one message and no invites, so only that text is checked. */
export function checkNetworkWording(connectedMessage: string | null | undefined): WordingProblem[] {
  const c = (connectedMessage ?? "").trim();
  if (!c) return [{ field: "connected_message_text", message: "Write the message people get." }];
  if (c.length > MESSAGE_LIMIT) return [{ field: "connected_message_text", message: `The message is over ${MESSAGE_LIMIT} characters.` }];
  return [];
}

/** A stable fingerprint of the exact wording. */
export function wordingHash(variants: InviteVariant[], message: string | null | undefined, connectedMessage?: string | null): string {
  // The existing connections text joins the fingerprint only when present, so approvals made before it existed stay valid.
  const c = (connectedMessage ?? "").trim();
  const canon = JSON.stringify({ v: variants.map((x) => [x.id, x.text.trim()]), m: (message ?? "").trim(), ...(c ? { c } : {}) });
  return createHash("sha256").update(canon).digest("hex");
}

/** True only when the stored approval still matches the wording as it is now. */
export function isApproved(c: { approved_at: string | null; wording_hash: string | null; invite_variants: InviteVariant[]; message_text: string | null; connected_message_text?: string | null }): boolean {
  if (!c.approved_at || !c.wording_hash) return false;
  return c.wording_hash === wordingHash(c.invite_variants, c.message_text, c.connected_message_text);
}

export function pickVariant(variants: InviteVariant[], rng: () => number = Math.random): InviteVariant | null {
  if (variants.length === 0) return null;
  return variants[Math.min(variants.length - 1, Math.floor(rng() * variants.length))];
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Fills {first_name} and {company}. Returns null when the result would not fit, so the text is never cut. */
export function renderInvite(text: string, who: { name: string | null; company?: string | null }): string | null {
  const out = fill(text, who).trim();
  return out.length > 0 && out.length <= INVITE_NOTE_LIMIT ? out : null;
}

function fill(text: string, who: { name: string | null; company?: string | null }): string {
  return text.replaceAll("{first_name}", firstName(who.name)).replaceAll("{company}", (who.company ?? "").trim());
}

/** Where the chat continues after an acceptance: our web chat for the agent. */
export function handoffLink(args: { appUrl: string; agent: "johnny" | "jessica"; targetId: string }): string {
  const base = args.appUrl.replace(/\/+$/, "");
  return `${base}/${args.agent}?src=linkedin&t=${encodeURIComponent(args.targetId)}`;
}

/** The message sent after an acceptance. The link is added if the text has no {link} spot. */
export function renderAcceptedMessage(text: string, who: { name: string | null; company?: string | null }, link: string | null): string {
  const filled = fill(text, who).trim();
  if (!link) return filled.replaceAll("{link}", "").trim();
  return filled.includes("{link}") ? filled.replaceAll("{link}", link) : `${filled}\n\n${link}`;
}

/** The message to someone already connected. Null when it would not fit, so the text is never cut. */
export function renderConnectedMessage(text: string, who: { name: string | null; company?: string | null }, link: string | null): string | null {
  const out = renderAcceptedMessage(text, who, link);
  return out.length > 0 && out.length <= MESSAGE_LIMIT ? out : null;
}

/** Investors go to Johnny, founders to Jessica. */
export function agentFor(module: string | null | undefined): "johnny" | "jessica" {
  return module === "founder" ? "jessica" : "johnny";
}
