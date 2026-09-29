/** IR auto sequence templates and event labels — client-safe (no IO). {founder} and {first} are filled at send time. */

export type SequenceStep = { day: number; subject: string; body: string };
export type SequenceEventKind = "sent" | "open" | "click" | "reply" | "meeting" | "paused" | "resumed" | "stopped" | "completed" | "failed";
export type AlertEvent = "open" | "click" | "reply" | "meeting";
export type StopEvent = "reply" | "meeting";

export const ALERT_EVENTS: Array<{ key: AlertEvent; label: string }> = [
  { key: "open", label: "Opens an email" }, { key: "click", label: "Clicks a link" },
  { key: "reply", label: "Replies" }, { key: "meeting", label: "Books a meeting" },
];
export const EVENT_LABEL: Record<SequenceEventKind, string> = {
  sent: "Sent", open: "Opened", click: "Clicked a link", reply: "Replied", meeting: "Meeting booked",
  paused: "Paused", resumed: "Resumed", stopped: "Stopped", completed: "Completed", failed: "Send failed",
};

export const SEQUENCE_TEMPLATES: Record<string, { name: string; steps: SequenceStep[] }> = {
  investor_intro: {
    name: "Investor intro",
    steps: [
      { day: 0, subject: "Introduction: {founder}", body: "Hi {first},\n\nI'd like to introduce you to {founder}. Would you be open to a 20 minute call next week?\n\nBest," },
      { day: 3, subject: "Quick follow up: {founder}", body: "Hi {first},\n\nFollowing up on my note about {founder}. Happy to share the deck or set up a short call.\n\nBest," },
      { day: 7, subject: "{founder}: traction update", body: "Hi {first},\n\nA short update on {founder} in case the timing is better now. Let me know if a call makes sense.\n\nBest," },
      { day: 14, subject: "Last note on {founder}", body: "Hi {first},\n\nI won't keep filling your inbox. If {founder} fits your thesis later, just reply and I'll set up a call.\n\nBest," },
    ],
  },
  warm_follow_up: {
    name: "Warm follow up",
    steps: [
      { day: 0, subject: "Following up: {founder}", body: "Hi {first},\n\nFollowing up on {founder}. Happy to share more or set up a call.\n\nBest," },
      { day: 4, subject: "{founder}: next steps", body: "Hi {first},\n\nWould a short call with the founders this week or next be useful?\n\nBest," },
      { day: 10, subject: "Checking in: {founder}", body: "Hi {first},\n\nChecking in one last time on {founder}. Reply any time if it's a fit.\n\nBest," },
    ],
  },
};

export function fillStep(text: string, vars: { founder: string; first: string }): string {
  return text.replace(/\{founder\}/g, vars.founder).replace(/\{first\}/g, vars.first);
}
