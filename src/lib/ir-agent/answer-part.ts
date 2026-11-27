/**
 * One message can answer and ask: "Software. Pre revenue. How much do you
 * charge?" Returns what the visitor stated, so the chat can keep it before it
 * replies to the question, instead of dropping the answer and asking again.
 * Greetings and thanks are not answers.
 */
const NOT_AN_ANSWER = /^(hi|hello|hey|thanks|thank you|thx|ok|okay)( there| again| a lot)?[\s,.!]*$/i;

export function statedPart(text: string): string {
  const pieces = text.trim().match(/[^.!?]+[.!?]*/g) ?? [];
  const stated = pieces
    .map((p) => p.trim())
    .filter((p) => p && !p.endsWith("?"))
    .join(" ")
    .trim();
  if (!stated || NOT_AN_ANSWER.test(stated) || stated.split(/\s+/).length < 2) return "";
  return stated;
}
