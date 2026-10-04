import type { SupportAiTriage } from "./support";

/** Pull the first {...} block out of a model reply and parse it. */
export function parseTriage(text: string): SupportAiTriage | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]) as Record<string, unknown>;
    const priority = v.priority === "low" || v.priority === "high" ? v.priority : "normal";
    const topic = typeof v.topic === "string" && v.topic.trim() ? v.topic.trim().slice(0, 60) : null;
    if (!topic) return null;
    return {
      topic,
      priority,
      canAiAnswer: v.canAiAnswer === true,
      reason: typeof v.reason === "string" ? v.reason.trim().slice(0, 200) : "",
    };
  } catch {
    return null;
  }
}
