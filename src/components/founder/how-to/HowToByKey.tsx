"use client";

import { HowToGuide } from "@/components/founder/how-to/HowToGuide";
import { guideByKey } from "@/lib/founder/how-to-lookup";

/** For a page that mounts its own guide, such as a tab with no route of its own. */
export function HowToByKey({ guideKey }: Readonly<{ guideKey: string }>) {
  const guide = guideByKey(guideKey);
  return guide ? <HowToGuide guide={guide} /> : null;
}
