export const COACH_DISCLAIMER =
  "CapitalOS provides educational support only. This is not legal, tax, investment, securities, or fundraising advice.";

export const QUIZ_REFUSAL_REPLY =
  "I can't give the quiz answer directly, but I can explain the concept so you can choose confidently.";

const QUIZ_ANSWER_PATTERN =
  /\b(quiz answer|correct answer|right answer|which option|what is the answer|give me the answer|answer key|choose [a-d]\b|pick [a-d]\b|option [a-d]\b|letter [a-d]\b|tell me [a-d]\b)\b/i;

const ADVICE_PATTERN =
  /\b(should i invest|buy stock|sell shares|tax advice|legal advice|securities law|guaranteed funding|sec approved|sec compliance|investor approved|file form d|regulation d)\b/i;

export function isQuizAnswerRequest(message: string) {
  return QUIZ_ANSWER_PATTERN.test(message.trim());
}

export function isRestrictedAdviceRequest(message: string) {
  return ADVICE_PATTERN.test(message.trim());
}
