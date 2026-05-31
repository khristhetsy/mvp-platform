"use client";

import { FloatingFounderAICoach } from "@/components/FloatingFounderAICoach";

/** Inline coach replaced by floating bot — re-export for compatibility */
export function FounderPersonalCoach({
  courseSlug,
  lessonSlug,
}: Readonly<{
  courseSlug?: string;
  lessonSlug?: string;
}>) {
  return <FloatingFounderAICoach courseSlug={courseSlug} lessonSlug={lessonSlug} />;
}
