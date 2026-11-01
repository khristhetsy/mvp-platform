/** What staff teach the sales AI agent's email drafts. Plain types, safe to import anywhere. */

export const DEFAULT_REFUND_LINE = "If your Capital Readiness Rating does not improve, we will refund your money.";

export const MAX_BLOCKED_WORDS = 30;
export const MAX_SKIP_PHRASES = 40;
export const MAX_SKIP_TAGS = 20;
export const MAX_DOCUMENTS = 10;
export const MAX_EXAMPLES = 30;
export const MAX_EXAMPLE_CHARS = 3000;
export const MIN_EXAMPLE_CHARS = 20;

export type TrainingSettings = {
  /** Added to the built-in banned words. They can never remove one. */
  blockedWords: string[];
  refundLine: string;
  skipPhrases: string[];
  skipTags: string[];
};

export const DEFAULT_SETTINGS: TrainingSettings = {
  blockedWords: [],
  refundLine: DEFAULT_REFUND_LINE,
  skipPhrases: [],
  skipTags: [],
};

export type TrainingDocument = {
  id: string;
  fileName: string;
  purpose: string | null;
  status: "processing" | "trained" | "failed";
  bytes: number | null;
  createdAt: string;
  /** Kept on the server. Not sent to the browser. */
  text?: string | null;
};

export type TrainingExample = {
  id: string;
  kind: "send" | "never";
  stageName: string | null;
  body: string;
  reason: string | null;
  createdAt: string;
};

/** What the drafting step actually used, shown in Test a draft and as an audit point. */
export type WordingUsed = {
  documents: string[];
  examplesSend: number;
  examplesNever: number;
  /** "guided" when the model wrote the bridge and value lines from the training, "fixed" for the built-in text. */
  mode: "guided" | "fixed";
  /** Why a guided attempt fell back to the fixed text. */
  fallbackReason: string | null;
};

export type SkipResult = { matched: string[] } | null;
