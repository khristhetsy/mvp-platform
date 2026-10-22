"use client";

import { usePathname } from "next/navigation";
import { HowToGuide } from "@/components/founder/how-to/HowToGuide";
import { guideForPath } from "@/lib/founder/how-to-lookup";

/** Mounted once in the founder workspace shell: shows the guide for the current page, or nothing. */
export function FounderHowTo() {
  const guide = guideForPath(usePathname());
  return guide ? <HowToGuide guide={guide} /> : null;
}
