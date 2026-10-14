/**
 * How the chat agents (Jessica, Michael, Daniela) behave like Johnny: they never
 * answer instantly, they check in once after five quiet minutes, and they stop for
 * good when asked to be removed. Johnny's own chat has the same rules in its own files.
 */

/** Five minutes of silence while the agent waits for the visitor. */
export const IDLE_MS = 5 * 60 * 1000;

export const AGENT_IDLE_LINES = ["Are you still there?", "Still with me? Happy to pick up where we left off."];

export const AGENT_OPTOUT_LINES = ["Understood, and thank you for telling me directly.", "I will not follow up with you. If that changes, you are always welcome here."];
export const AGENT_OPTOUT_AFTER = "Thank you. Your preference is noted and I will not contact you again.";

const OPT_OUT = /unsubscribe|remove me|take me off|stop (emailing|contacting|messaging|texting)|do not contact|don'?t (contact|message|email)|leave me alone/i;

/** True when the visitor asks not to be contacted. Ends the conversation at once. */
export function isOptOut(text: string): boolean {
  return OPT_OUT.test(text.trim());
}

/** Pause before the agent starts typing a reply: one to two seconds. `rand` is 0 to 1. */
export function replyPauseMs(rand: number): number {
  return 1200 + Math.round(Math.max(0, Math.min(1, rand)) * 800);
}

/**
 * How long one line takes to type. The opening is quick, about five seconds in all;
 * every reply after the visitor speaks types at a human pace.
 */
export function typingMs(lineLength: number, opening: boolean): number {
  return opening ? 400 + Math.min(lineLength * 10, 1000) : 600 + Math.min(lineLength * 18, 1800);
}
