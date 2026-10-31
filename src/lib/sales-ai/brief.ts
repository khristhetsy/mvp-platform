/**
 * The meeting cycle's pure parts: the brief before a meeting and the tasks
 * suggested after one. No reading happens here. The brief is built from the same
 * audit the email uses, so it can only say what the record says.
 */
import { CLOSING_QUESTION } from "./objection";
import type { Audit, MeetingBrief, Objection, SuggestedTask } from "./types";

/** Closing questions 1, 2 and 4 from the sales training, used when nothing is known yet. */
const GENERAL_QUESTIONS = [
  "Based on our discussion, do you think our solution fits your needs? Why?",
  "Are there any obstacles that could prevent this deal from happening?",
  "When do you want to decide and begin implementing a solution?",
];

export function meetingQuestions(objection: Objection): string[] {
  if (objection === "unknown") return GENERAL_QUESTIONS;
  const specific = CLOSING_QUESTION[objection];
  return [specific, ...GENERAL_QUESTIONS.filter((q) => q !== specific)].slice(0, 4);
}

export function buildMeetingBrief(input: { title: string; contactName: string | null; stageName: string | null; audit: Audit }): MeetingBrief {
  const { audit } = input;
  const said = audit.points
    .filter((p) => p.label === "They asked" || p.label === "Concern" || p.label === "Agent chat")
    .map((p) => ({ text: `${p.label}: ${p.text}`, source: p.sources[0] ?? "Thread", quote: Boolean(p.quote) }));
  return {
    who: input.contactName ? `${input.contactName}, ${input.title}` : input.title,
    stageName: input.stageName,
    said,
    likelyObjection: audit.objection === "unknown" ? "Not known yet. Ask early." : `${audit.objection}. Playbook: ${audit.technique}`,
    questions: meetingQuestions(audit.objection),
    notOnFile: audit.notOnFile,
  };
}

/** Tasks to offer after a meeting. Each one is added only when a person clicks it. */
export function suggestTasks(input: { contactName: string | null; objection: Objection }): SuggestedTask[] {
  const who = input.contactName?.trim() || "the contact";
  const tasks: SuggestedTask[] = [
    { title: `Send the follow up to ${who}`, taskType: "Email", dueInDays: 1, summary: "Review and send the AI agent's follow up draft." },
    { title: `Call ${who} if there is no reply`, taskType: "Call", dueInDays: 5, summary: "No reply to the follow up. Call, and offer two times." },
  ];
  if (input.objection === "team") tasks.push({ title: `Ask ${who} how their team's review went`, taskType: "Follow-up", dueInDays: 3, summary: "They need to check with their team or board." });
  return tasks;
}
