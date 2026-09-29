import { describe, expect, it } from "vitest";
import { QUESTION_ORDER, nextQuestion, previousQuestion, questionPosition } from "@/lib/onboarding/question-order";

const none = () => false;

describe("founder onboarding question order", () => {
  it("asks scored questions before the prose", () => {
    expect(QUESTION_ORDER.slice(-2)).toEqual([5, 6]);
    expect(questionPosition(7)).toBe(5);
    expect(questionPosition(6)).toBe(8);
  });
  it("walks forward and back through the order", () => {
    expect(nextQuestion(4, none)).toBe(7);
    expect(nextQuestion(8, none)).toBe(5);
    expect(nextQuestion(6, none)).toBeNull();
    expect(previousQuestion(7, none)).toBe(4);
    expect(previousQuestion(5, none)).toBe(8);
    expect(previousQuestion(1, none)).toBeNull();
  });
  it("skips hidden questions both ways", () => {
    const hide34 = (q: number) => q === 3 || q === 4;
    expect(nextQuestion(2, hide34)).toBe(7);
    expect(previousQuestion(7, hide34)).toBe(2);
  });
});
