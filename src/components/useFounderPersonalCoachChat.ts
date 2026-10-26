"use client";

import { useCallback, useState } from "react";
import { COACH_DISCLAIMER } from "@/lib/learning/class-assistant-guardrails";
import { ONBOARDING_QUICK_PROMPTS } from "@/lib/learning/onboarding-coach";

export type CoachChatEntry = { role: "user" | "assistant"; text: string };

export function useFounderPersonalCoachChat({
  courseSlug,
  lessonSlug,
  stepIndex,
  surface,
}: Readonly<{
  courseSlug?: string;
  lessonSlug?: string;
  /** "onboarding" switches the coach to guide the required onboarding steps. */
  surface?: "onboarding";
  /** The coach step the founder is looking at, so the coach answers about that step. */
  stepIndex?: number;
}>) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<CoachChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"claude" | "fallback" | "guardrail" | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setMessage("");
      setLoading(true);

      const history = messages.map((m) => ({
        role: m.role,
        content: m.role === "assistant" ? (m.text.split("\n\n")[0] ?? m.text) : m.text,
      }));

      const response = await fetch("/api/founder/learning/class-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: courseSlug ?? undefined,
          lessonSlug: lessonSlug ?? undefined,
          stepIndex: typeof stepIndex === "number" ? stepIndex : undefined,
          surface: surface ?? undefined,
          message: trimmed,
          history,
        }),
      });

      setLoading(false);

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "The coach is temporarily unavailable. You can still use course materials and quizzes — try again in a moment.",
          },
        ]);
        return;
      }

      const body = (await response.json()) as {
        reply: string;
        disclaimer?: string;
        mode?: "claude" | "fallback" | "guardrail";
        claudeAvailable?: boolean;
      };

      setMode(body.mode ?? null);
      setClaudeAvailable(body.claudeAvailable ?? null);

      const disclaimer = body.disclaimer ?? COACH_DISCLAIMER;
      setMessages((prev) => [...prev, { role: "assistant", text: `${body.reply}\n\n${disclaimer}` }]);
    },
    [courseSlug, lessonSlug, stepIndex, surface, loading, messages],
  );

  const send = useCallback(() => void sendMessage(message), [message, sendMessage]);

  const sendPrompt = useCallback((prompt: string) => void sendMessage(prompt), [sendMessage]);

  return {
    message,
    setMessage,
    messages,
    loading,
    mode,
    claudeAvailable,
    send,
    sendMessage,
    sendPrompt,
  };
}

export function getCoachQuickPrompts({
  courseSlug,
  lessonSlug,
  surface,
}: Readonly<{ courseSlug?: string; lessonSlug?: string; surface?: "onboarding" }>) {
  if (surface === "onboarding") return ONBOARDING_QUICK_PROMPTS;
  if (lessonSlug && courseSlug) {
    return [
      "Explain this lesson in simple terms",
      "Why does this topic matter for investors?",
      "What should I study next?",
    ];
  }
  if (courseSlug) {
    return [
      "What should I study next in this course?",
      "Summarize what this course covers",
      "Pitch deck education tips",
    ];
  }
  return [
    "Which course should I start with?",
    "Help with pitch deck education",
    "How do I navigate iCapOS learning?",
  ];
}
