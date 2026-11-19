/**
 * Staff started messages: a support thread that iCFO staff open with a client,
 * instead of the client opening it. It is a normal support request (source
 * "manual"), so replies, internal notes, PDF attachments, assignment and
 * resolve all work as they do for a request the client opened.
 */
import { z } from "zod";

/** Only founders and investors have a support page to reply from. */
export const MANUAL_REQUESTER_ROLES = ["founder", "investor"] as const;

export const newMessageSchema = z.object({
  requesterId: z.string().uuid(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  assigneeId: z.string().uuid().nullish(),
  /** Email the client a link to the thread. The in app notification is always sent. */
  emailRequester: z.boolean().default(true),
});

export const rewriteSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("rewrite"),
    tone: z.enum(["shorter", "friendlier"]),
    base: z.string().trim().min(1).max(4000),
    assigneeId: z.string().uuid().nullish(),
  }),
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
  "You are an iCapOS team member writing to a client on the iCapOS fundraising platform. Be specific, warm and short. Plain text only. Never promise funding, a refund, a credit, or a legal or financial outcome. Never say you will check, confirm or provide something iCapOS does not have. Keep it under 120 words.";

export function rewritePrompt(tone: "shorter" | "friendlier", base: string): string {
  return `Rewrite this message to a client so it is ${tone === "shorter" ? "shorter and more direct, keeping every fact" : "warmer and friendlier, keeping every fact"}. Plain text only. Keep the sign-off name at the end unchanged.\n\nMessage:\n${base}`;
}

export function writePrompt(input: { subject: string; requesterName: string | null; planLabel: string | null }): string {
  const who = input.requesterName ? `The client is ${input.requesterName}.` : "";
  const plan = input.planLabel ? ` Their plan is ${input.planLabel}.` : "";
  return `Write a first message from the iCapOS team to a client. The subject is "${input.subject}". ${who}${plan}\n\nUse only what is given here. Never invent dates, numbers, features or promises. Ask for one clear next step if the subject calls for it. Plain text, a short greeting, no sign-off block.`;
}
