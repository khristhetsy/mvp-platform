import { claudeComplete } from "@/lib/claude";
import { toneInstruction, type CoachTone } from "@/lib/learning/coach/tones";
import type { TrainingExercise, TrainingModule } from "./catalog";

export const QUIET_TRAINEE_DAYS = [3, 7, 14] as const;

const GUARD = [
  "You coach a trainee on how to use the iCapOS admin workspace.",
  "Use only the lesson text provided. If it does not cover the question, say so plainly and suggest asking the reviewer.",
  "Never promise refunds, credits, outcomes or funding. Never offer to change a field a client set themselves.",
  "Give workflow guidance only, not legal, tax or investment advice. Keep replies under 120 words.",
  "Do not use em dashes or hyphens as sentence punctuation.",
].join(" ");

function lessonText(mod: TrainingModule): string {
  return (mod.steps ?? [])
    .map((s, i) => `Step ${i + 1}: ${s.title}. ${s.intro} ${s.doList.join(" ")} ${s.notes.join(" ")}`)
    .join("\n");
}

export type CoachContext = { module: TrainingModule; tone: CoachTone };

export function buildAskPrompt(ctx: CoachContext, question: string) {
  return {
    system: `${GUARD} ${toneInstruction(ctx.tone)}\n\nLESSON\n${lessonText(ctx.module)}`,
    user: question.slice(0, 1500),
  };
}

export function buildFeedbackPrompt(ctx: CoachContext, exercise: TrainingExercise, answer: string) {
  return {
    system: `${GUARD} ${toneInstruction(ctx.tone)} Give a first pass on the trainee's answer: what is right, what is missing or wrong, one next improvement. A human reviewer decides Pass or Redo, so do not say the trainee passed.\n\nLESSON\n${lessonText(ctx.module)}`,
    user: `Exercise: ${exercise.title}. ${exercise.prompt}\n\nTrainee answer:\n${answer.slice(0, 6000)}`,
  };
}

/** Returns null when the AI is unavailable, so callers can show a plain message. */
export async function coachReply(system: string, user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const text = await claudeComplete([{ role: "user", content: user }], {
      system,
      maxTokens: 400,
      usage: { category: "internal", feature: "staff_training_coach" },
    });
    return text.trim() || null;
  } catch {
    return null;
  }
}
