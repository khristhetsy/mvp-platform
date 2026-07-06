// Seed deck slides from the founder's business plan + company profile.
import { DECK_SLIDES } from "./slides";
import type { DeckSlideContent } from "./types";
import type { BusinessPlan } from "@/lib/business-plan/types";

export interface DeckCompanyContext {
  name: string;
  industry: string | null;
  stage: string | null;
  description: string | null;
  fundingAmount: number | null;
}

/** First 3 sentence-ish fragments of a block, as bullets. */
function toBullets(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  return parts.map((p) => `• ${p.replace(/^[•\-*]\s*/, "")}`).join("\n");
}

export function prefillSlides(
  company: DeckCompanyContext,
  plan: BusinessPlan | null,
  existing: Record<string, DeckSlideContent>,
): Record<string, DeckSlideContent> {
  const out: Record<string, DeckSlideContent> = { ...existing };
  for (const def of DECK_SLIDES) {
    if (out[def.id]?.headline || out[def.id]?.body) continue; // don't overwrite founder edits
    if (def.id === "title") {
      out.title = { headline: company.name, body: company.description ? `• ${company.description}` : "• [One line: what you do, for whom]", aiGenerated: false };
      continue;
    }
    if (def.id === "contact") {
      out.contact = { headline: "Let's talk", body: `• ${company.name}\n• [founder@email]\n• [website]`, aiGenerated: false };
      continue;
    }
    const section = def.fromSection ? plan?.sections?.[def.fromSection]?.content?.trim() : "";
    if (section) {
      out[def.id] = { headline: def.title, body: toBullets(section), aiGenerated: false };
    } else {
      out[def.id] = { headline: def.title, body: "• [Add your points — or click Write from my plan]", aiGenerated: false };
    }
  }
  return out;
}
