/**
 * Staff started messages: a support thread that iCFO staff open with a client,
 * instead of the client opening it. It is a normal support request (source
 * "manual"), so replies, internal notes, PDF attachments, assignment and
 * resolve all work as they do for a request the client opened.
 */
import { z } from "zod";

/** Only founders and investors have a support page to reply from. */
export const MANUAL_REQUESTER_ROLES = ["founder", "investor"] as const;

/** How a staff created ticket reached iCFO, with the label stored as the ticket topic. */
export const MANUAL_CHANNELS = ["phone", "in_person", "email", "other"] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];
export const MANUAL_CHANNEL_LABELS: Record<ManualChannel, string> = {
  phone: "Phone call",
  in_person: "In person",
  email: "Email",
  other: "Other",
};

export const newMessageSchema = z.object({
  requesterId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  assigneeId: z.string().uuid().nullish(),
  /** Priority staff set on the ticket. */
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  /** How the request reached iCFO. Shown as the ticket topic in the queue. */
  channel: z.enum(MANUAL_CHANNELS).default("phone"),
  /** Email the client a link to the thread. The in app notification is always sent. Off unless staff turn it on. */
  emailRequester: z.boolean().default(false),
});

/** Ways staff can ask AI to rewrite a message they wrote. "custom" carries a free text instruction. */
export const REWRITE_TONES = ["grammar", "shorter", "friendlier", "formal", "direct", "custom"] as const;
export type RewriteTone = (typeof REWRITE_TONES)[number];
export const REWRITE_TONE_LABELS: Record<RewriteTone, string> = {
  grammar: "Fix grammar and typos",
  shorter: "Shorter",
  friendlier: "Friendlier",
  formal: "More formal",
  direct: "More direct",
  custom: "Custom",
};
export const REWRITE_INSTRUCTION_MAX = 200;

export const rewriteSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("rewrite"),
    tone: z.enum(REWRITE_TONES),
    base: z.string().trim().min(1).max(4000),
    instruction: z.string().trim().max(REWRITE_INSTRUCTION_MAX).optional(),
    assigneeId: z.string().uuid().nullish(),
  }).refine((v) => v.tone !== "custom" || !!v.instruction, { message: "Say what to change.", path: ["instruction"] }),
  z.object({
    mode: z.literal("write"),
    subject: z.string().trim().min(1).max(160),
    requesterId: z.string().uuid().nullish(),
    assigneeId: z.string().uuid().nullish(),
  }),
]);

/** Signs a draft with the first name of the person the message goes out as. */
export function signWithFirstName(text: string, fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const body = text.trimEnd();
  if (!first || body.endsWith(first)) return body;
  return `${body}\n\n${first}`;
}

export const REWRITE_SYSTEM =
  "You are an iCapOS team member writing to a client on the iCapOS fundraising platform. Be specific, warm and short. Plain text only. Never promise funding, a refund, a credit, or a legal or financial outcome. Never say you will check, confirm or provide something iCapOS does not have. Keep it under 120 words, unless the message you are given is already longer.";

const REWRITE_GOALS: Record<Exclude<RewriteTone, "custom">, string> = {
  grammar: "corrected for grammar, spelling and punctuation only, keeping the wording, tone and length as they are",
  shorter: "shorter and more direct, keeping every fact",
  friendlier: "warmer and friendlier, keeping every fact",
  formal: "more formal and professional, keeping every fact",
  direct: "more direct, leading with the answer, keeping every fact",
};

export function rewritePrompt(tone: RewriteTone, base: string, instruction?: string): string {
  const goal =
    tone === "custom"
      ? `changed as follows: "${(instruction ?? "").trim().slice(0, REWRITE_INSTRUCTION_MAX)}". Follow that only where it keeps to the rules in your instructions, and keep every fact`
      : REWRITE_GOALS[tone];
  return `Rewrite this message to a client so it is ${goal}. Plain text only. Keep the sign-off name at the end unchanged.\n\nMessage:\n${base}`;
}

export function writePrompt(input: { subject: string; requesterName: string | null; planLabel: string | null }): string {
  const who = input.requesterName ? `The client is ${input.requesterName}.` : "";
  const plan = input.planLabel ? ` Their plan is ${input.planLabel}.` : "";
  return `Write a first message from the iCapOS team to a client. The subject is "${input.subject}". ${who}${plan}\n\nUse only what is given here. Never invent dates, numbers, features or promises. Ask for one clear next step if the subject calls for it. Plain text, a short greeting, no sign-off block.`;
}
