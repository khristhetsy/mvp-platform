export type PitchDeckStatus = "draft" | "finalized";

export interface DeckSlideContent {
  headline: string;
  body: string;
  aiGenerated: boolean;
}

export interface PitchDeck {
  id: string;
  companyId: string;
  /** slideId → content */
  slides: Record<string, DeckSlideContent>;
  theme: string;
  status: PitchDeckStatus;
  shareToken: string | null;
  aiAssisted: boolean;
  generatedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string | null;
}
