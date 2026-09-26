/**
 * The order the founder onboarding questions are asked in, by question number.
 * Scored questions first; the ones a person reads (description, then use of
 * funds and timeline) last, so the matchable points meter fills first.
 * Question numbers themselves never change.
 */
export const QUESTION_ORDER = [1, 2, 3, 4, 7, 8, 5, 6] as const;
export type QuestionNum = (typeof QUESTION_ORDER)[number];

/** 1 based position of a question in the order. */
export function questionPosition(n: QuestionNum): number {
  return QUESTION_ORDER.indexOf(n) + 1;
}

/** The next question to show, skipping hidden ones; null after the last. */
export function nextQuestion(n: QuestionNum, skipped: (q: QuestionNum) => boolean): QuestionNum | null {
  const pos = questionPosition(n);
  if (pos >= QUESTION_ORDER.length) return null;
  let i = pos;
  while (i < QUESTION_ORDER.length - 1 && skipped(QUESTION_ORDER[i]!)) i += 1;
  return QUESTION_ORDER[i]!;
}

/** The previous question to show, skipping hidden ones; null before the first. */
export function previousQuestion(n: QuestionNum, skipped: (q: QuestionNum) => boolean): QuestionNum | null {
  const pos = questionPosition(n);
  if (pos <= 1) return null;
  let i = pos - 2;
  while (i > 0 && skipped(QUESTION_ORDER[i]!)) i -= 1;
  return QUESTION_ORDER[i]!;
}
