import { CLAUDE_HAIKU, claudeComplete, isClaudeConfigured, type ClaudeMessage } from "@/lib/claude";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventWithDetail } from "@/lib/icfo-events/types";

const SYSTEM = `You are the iCFO Events Info Desk — a warm, concise assistant that helps attendees get around a virtual event.

Use ONLY the event context provided. You help with: what's on the agenda, where to go (Lobby, Sessions / Main Stage, Networking Lounge, On-Demand, Sponsor Hall, Leaderboard), who to meet, and how points and badges work.

Rules:
- Keep replies to 1–3 short sentences. Plain prose, no markdown, no lists.
- You are NOT a financial, legal, investment, or securities advisor. If asked for investment/financial/legal advice, or anything that recommends or solicits a security, deal, or company to invest in, politely decline and note this is an educational community event, not an offer of securities.
- Never invent sessions, people, prices, or facts that are not in the context. If you don't know, say so and point them to the Lobby or Agenda.
- When relevant, tell the attendee which venue area to head to.`;

/** Assemble a compact, factual context block from real event data. */
export function buildEventContext(
  event: EventWithDetail,
  member?: { points: number; badges: string[] } | null,
): string {
  const lines: string[] = [];
  lines.push(`Event: ${event.title} (status: ${event.status})`);
  if (event.startsAt) lines.push(`Starts: ${new Date(event.startsAt).toLocaleString()}`);
  lines.push(`Format: ${event.format.replace("_", " ")}`);
  if (event.sectors.length) {
    lines.push(`Sector tracks: ${event.sectors.map((s) => s.label || sectorLabel(s.sectorSlug)).join(", ")}`);
  }
  if (event.sessions.length) {
    lines.push("Agenda:");
    for (const s of event.sessions.slice(0, 12)) {
      const when = s.startsAt ? `${new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ` : "";
      lines.push(`- ${when}${s.title} [${s.status}]`);
    }
  }
  lines.push("Venue rooms: Lobby, Sessions (Main Stage), Networking Lounge, On-Demand, Sponsor Hall, Leaderboard.");
  if (member) {
    lines.push(`This attendee has ${member.points} points and badges: ${member.badges.join(", ") || "none yet"}.`);
  }
  return lines.join("\n");
}

/** Answer an attendee question grounded in the event context. Falls back to a
 *  deterministic reply when Claude isn't configured. */
export async function answerEventQuestion(
  history: ClaudeMessage[],
  message: string,
  context: string,
): Promise<string> {
  if (!isClaudeConfigured()) {
    return "I'm the event info desk. You can head to the Lobby to choose where to go, check the Agenda for what's on, or open the Networking Lounge to meet people.";
  }
  try {
    const messages: ClaudeMessage[] = [...history.slice(-6), { role: "user", content: message }];
    const text = await claudeComplete(messages, {
      model: CLAUDE_HAIKU,
      maxTokens: 220,
      system: `${SYSTEM}\n\nEVENT CONTEXT:\n${context}`,
    });
    return text.trim() || "I'm not sure about that — try the Lobby or the Agenda.";
  } catch {
    return "I couldn't reach the assistant just now. The Lobby and Agenda have what you need in the meantime.";
  }
}
