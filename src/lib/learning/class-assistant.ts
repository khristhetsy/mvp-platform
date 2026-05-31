const DISCLAIMER =
  "Educational founder training only — not legal, tax, securities, or investment advice. No funding guarantees or investor approval claims.";

const QUIZ_ANSWER_PATTERN =
  /\b(quiz answer|correct answer|which option|what is the answer|give me the answer|answer key)\b/i;

const ADVICE_PATTERN =
  /\b(should i invest|buy stock|sell shares|tax advice|legal advice|securities law|guaranteed funding|sec approved|file form)\b/i;

export function buildClassAssistantReply(input: {
  message: string;
  lessonTitle: string;
  lessonContent: string;
  keyPoints?: string[];
}) {
  const trimmed = input.message.trim();
  if (!trimmed) {
    return {
      reply: "Ask a question about this lesson’s concepts — for example, how investors screen startups or how to structure your overview.",
      disclaimer: DISCLAIMER,
    };
  }

  if (QUIZ_ANSWER_PATTERN.test(trimmed)) {
    const concept = input.keyPoints?.[0] ?? input.lessonContent.slice(0, 200);
    return {
      reply: `I can’t provide quiz answers. Here’s the underlying concept to study: ${concept} Review the lesson transcript and key points, then apply them to your own company materials.`,
      disclaimer: DISCLAIMER,
    };
  }

  if (ADVICE_PATTERN.test(trimmed)) {
    return {
      reply:
        "I’m limited to educational founder training on this lesson. For legal, tax, securities, or investment decisions, consult qualified professionals. I can help explain general investor preparation concepts from the course.",
      disclaimer: DISCLAIMER,
    };
  }

  const lower = trimmed.toLowerCase();
  const points = input.keyPoints ?? [];
  const matched = points.find((p) => lower.split(/\s+/).some((w) => w.length > 4 && p.toLowerCase().includes(w)));

  if (matched) {
    return {
      reply: `Regarding “${input.lessonTitle}”: ${matched} For your company, map this to your profile, deck, and document room on CapitalOS.`,
      disclaimer: DISCLAIMER,
    };
  }

  const excerpt = input.lessonContent.length > 320 ? `${input.lessonContent.slice(0, 320)}…` : input.lessonContent;

  return {
    reply: `On “${input.lessonTitle}”: ${excerpt} Tell me which part you want unpacked (screening, positioning, traction, or materials).`,
    disclaimer: DISCLAIMER,
  };
}
