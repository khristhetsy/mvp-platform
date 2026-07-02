export type PlaybookBlock = "open" | "core" | "close";
export type Cadence = "daily" | "2-3x_week" | "weekly" | "monthly";
export type FlagKind = "hard_gate" | "guardrail";
export type CardState = "ok" | "no_steps" | "undocumented";

export interface PlaybookStep {
  step_no: number;
  body: string;
}
export interface PlaybookFlag {
  kind: FlagKind;
  label: string;
}

export interface PlaybookContent {
  navId: string;
  block: PlaybookBlock;
  sortOrder: number;
  roleNote: string | null;
  cadence: Cadence;
  countSource: string | null;
  steps: PlaybookStep[];
  flags: PlaybookFlag[];
  updatedAt: string;
}

export interface PlaybookCard {
  navId: string;
  label: string;
  group: string;
  href: string;
  content: PlaybookContent | null;
  state: CardState;
}

export interface OrphanEntry {
  navId: string;
  block: string;
  steps: number;
}

export interface AssembledPlaybook {
  cards: PlaybookCard[];
  orphaned: OrphanEntry[];
  generatedAt: string;
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: "Daily",
  "2-3x_week": "2–3× / week",
  weekly: "Weekly",
  monthly: "Monthly",
};
export const BLOCK_LABEL: Record<PlaybookBlock, string> = {
  open: "Open the day",
  core: "Core operations",
  close: "Close the day",
};
