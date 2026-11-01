/**
 * The audit: what the sales AI agent read and what it found.
 *
 * `buildAudit` is pure. It turns the opportunity record, the timeline and the
 * agent chats into a list of points that each carry their source, and says what
 * the record does not hold instead of filling the gap. `extractQuotes` is the
 * only place a model is used, and every quote it returns is checked against the
 * thread (see quotes.ts) before it is accepted.
 */
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import type { TimelineItem } from "@/lib/sales/chatter-merge";
import { classifyObjection, CLOSING_QUESTION, TECHNIQUE } from "./objection";
import { acceptQuotes, parseExtraction, type Extraction } from "./quotes";
import type { Audit, AuditPoint, ChannelRead } from "./types";

export type ChatConv = {
  id: string;
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  booked: boolean;
  stopped: boolean;
  updatedAt: string;
};

export type AuditOpportunity = {
  title: string;
  contact_email: string | null;
  value_cents: number | null;
  expected_close: string | null;
};

const EMAIL_KINDS = ["email", "email_draft", "message", "odoo_message"];
const NOTE_KINDS = ["note", "opp_note", "odoo_note"];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The thread as plain text. Used both for the model and for checking its quotes. */
export function threadText(items: TimelineItem[], chats: ChatConv[]): string {
  const lines = [...items]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-40)
    .map((i) => `[${shortDate(i.created_at)}] ${i.kind}${i.actor_name ? ` (${i.actor_name})` : ""}: ${i.summary.replace(/\s+/g, " ").slice(0, 500)}`);
  for (const c of chats) {
    for (const m of c.transcript) {
      if (m.role === "user") lines.push(`[chat] prospect: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Only what the prospect wrote: their chat messages and messages from them in the timeline.
 * Notes are the team's own words, and sent emails and drafts are ours, so none of those can
 * be quoted back to the prospect as theirs. A message counts as theirs when its author shares
 * a name with the contact. With no contact name, no timeline message counts.
 */
export function prospectThread(items: TimelineItem[], chats: ChatConv[], contactName: string | null): string {
  const tokens = (contactName ?? "").toLowerCase().split(/[^\p{L}]+/u).filter((t) => t.length >= 3);
  const theirs = (i: TimelineItem) =>
    i.group === "message" &&
    i.kind !== "email_draft" &&
    !/^Email sent: /.test(i.summary) &&
    tokens.length > 0 &&
    tokens.some((t) => (i.actor_name ?? "").toLowerCase().includes(t));
  const lines = [...items]
    .filter(theirs)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-40)
    .map((i) => `[${shortDate(i.created_at)}] ${i.kind}${i.actor_name ? ` (${i.actor_name})` : ""}: ${i.summary.replace(/\s+/g, " ").slice(0, 500)}`);
  for (const c of chats) {
    for (const m of c.transcript) {
      if (m.role === "user") lines.push(`[chat] prospect: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`);
    }
  }
  return lines.join("\n");
}

/** What the prospect typed in the agent chat, for objection reading. */
export function chatUserMessages(chats: ChatConv[]): string[] {
  return chats.flatMap((c) => c.transcript.filter((m) => m.role === "user").map((m) => m.content));
}

export function buildAudit(input: {
  opportunity: AuditOpportunity;
  stageName: string | null;
  items: TimelineItem[];
  chats: ChatConv[];
  quotes: Extraction;
  aiRead: boolean;
  /** What the person wrote after a meeting. Their words, so never shown as the prospect's quote. */
  meetingNotes?: string;
}): Audit {
  const { opportunity, stageName, items, chats, quotes, aiRead, meetingNotes } = input;
  const points: AuditPoint[] = [];

  points.push({ label: "Stage", text: stageName ?? "No stage set", sources: ["Opportunity record"] });

  const newest = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (newest) {
    points.push({
      label: "Last activity",
      text: `${shortDate(newest.created_at)}: ${newest.summary.replace(/\s+/g, " ").slice(0, 90)}`,
      sources: ["Notes log"],
    });
  }

  if (quotes.asked) points.push({ label: "They asked", text: `"${quotes.asked}"`, sources: ["Thread"], quote: true });
  if (quotes.concern) points.push({ label: "Concern", text: `"${quotes.concern}"`, sources: ["Thread"], quote: true });

  if (chats.length) {
    const booked = chats.some((c) => c.booked);
    const stopped = chats.some((c) => c.stopped);
    const bits = [`Chatted with the agent ${chats.length} time${chats.length === 1 ? "" : "s"}`];
    if (booked) bits.push("booked a time");
    if (stopped) bits.push("stopped a chat");
    points.push({ label: "Agent chat", text: `${bits.join(", ")}.`, sources: ["Agent chat"] });
  }

  if (meetingNotes?.trim()) points.push({ label: "Your meeting notes", text: meetingNotes.trim().replace(/\s+/g, " ").slice(0, 400), sources: ["Your notes"] });

  const prospectWords = [quotes.asked, quotes.concern, ...chatUserMessages(chats), meetingNotes];
  const objection = classifyObjection(prospectWords);
  points.push({ label: "Objection type", text: `${objection === "unknown" ? "Not clear from the thread" : objection}. Playbook: ${TECHNIQUE[objection]}`, sources: ["Sales training"] });

  const count = (kinds: string[]) => items.filter((i) => kinds.includes(i.kind)).length;
  const channels: ChannelRead[] = [
    { name: "Email and messages", count: count(EMAIL_KINDS), read: true },
    { name: "Notes", count: count(NOTE_KINDS), read: true },
    { name: "Calls", count: count(["call"]), read: true },
    { name: "Agent chat", count: chats.length, read: true },
  ];

  const notOnFile: string[] = [];
  if (!opportunity.contact_email) notOnFile.push("Contact email");
  if (opportunity.value_cents == null) notOnFile.push("Deal value");
  if (!opportunity.expected_close) notOnFile.push("Expected close date");
  if (!aiRead) notOnFile.push("The prospect's own words (the AI reading is not configured)");

  return {
    points,
    channels,
    notOnFile,
    asked: quotes.asked,
    concern: quotes.concern,
    objection,
    technique: TECHNIQUE[objection],
    closingQuestion: CLOSING_QUESTION[objection],
    aiRead,
  };
}

const EXTRACT_SYSTEM = `You read a sales thread between iCFO and a prospect and return JSON only.
Return {"asked": string|null, "concern": string|null}.
"asked" is the prospect's main question, "concern" is their main hesitation.
Each value must be copied exactly, word for word, from a message the prospect wrote, at most 200 characters.
If the prospect did not write one, return null for it. Never paraphrase, summarize or invent. Output the JSON object and nothing else.`;

/** Asks the model for the prospect's own words, then keeps only quotes found in the thread. */
export async function extractQuotes(thread: string): Promise<{ quotes: Extraction; aiRead: boolean }> {
  if (!thread.trim() || !isClaudeConfigured()) return { quotes: { asked: null, concern: null }, aiRead: false };
  try {
    const raw = await claudeComplete([{ role: "user", content: thread }], {
      model: CLAUDE_HAIKU,
      system: EXTRACT_SYSTEM,
      maxTokens: 400,
      temperature: 0,
      locale: "en",
      usage: { category: "internal", feature: "sales_ai_agent" },
    });
    return { quotes: acceptQuotes(parseExtraction(raw), thread), aiRead: true };
  } catch {
    return { quotes: { asked: null, concern: null }, aiRead: false };
  }
}
