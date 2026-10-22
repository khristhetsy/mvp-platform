export type HowToTapKind = "button" | "link" | "field" | "check" | "watch";

export type HowToStep = {
  title: string;
  desc: string;
  tap: { kind: HowToTapKind; label: string };
  then: string;
};

export type HowToGuideData = {
  /** Stable id, also the key the founder's "hidden" choice is remembered under. */
  key: string;
  /** Exact founder routes the guide appears on. Empty when a page mounts it itself. */
  routes: string[];
  title: string;
  steps: HowToStep[];
};
