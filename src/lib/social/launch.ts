/**
 * Launch my social media: pure helpers for the founder Social media wizard (no I/O).
 * The page keeps the same API routes; this file only decides what to show.
 */

export type LaunchScreen = "home" | "connect" | "campaign" | "post" | "review";

/** Old links (?tab=...) still land somewhere useful now that the seven tabs are gone. */
export function screenForTab(tab: string | null | undefined): LaunchScreen {
  switch (tab) {
    case "compose": return "post";
    case "settings": return "connect";
    case "campaigns": return "campaign";
    case "overview":
    case "attribution": return "review";
    default: return "home"; // schedule, library, anything else
  }
}

export type SetupStepKey = "connect" | "campaign" | "post" | "review";
export type SetupStep = { key: SetupStepKey; label: string; done: boolean };

export type SetupInput = {
  accounts: { status: string }[];
  campaigns: number;
  posts: PostLike[];
  reviewed: boolean;
};

/** The four launch steps in order, each marked done from real data. */
export function setupProgress(input: SetupInput): { steps: SetupStep[]; doneCount: number } {
  const steps: SetupStep[] = [
    { key: "connect", label: "Connect an account", done: input.accounts.some((a) => a.status === "connected" || a.status === "expiring") },
    { key: "campaign", label: "Create a campaign", done: input.campaigns > 0 },
    { key: "post", label: "Write a post", done: input.posts.some((p) => { const s = postState(p).key; return s === "scheduled" || s === "published"; }) },
    { key: "review", label: "Weekly review", done: input.reviewed },
  ];
  return { steps, doneCount: steps.filter((s) => s.done).length };
}

export type PostLike = {
  status: string;
  held_until: string | null;
  archived_at: string | null;
  variants: { status: string; url?: string | null }[];
};

export type PostStateKey = "archived" | "waiting" | "failed" | "published" | "scheduled" | "draft";

/** One plain state per post, from the post row and its per account variants. */
export function postState(p: PostLike): { key: PostStateKey; label: string } {
  if (p.archived_at) return { key: "archived", label: "Archived" };
  if (p.held_until) return { key: "waiting", label: "Draft, waiting for reset" };
  const v = p.variants.map((x) => x.status);
  const anyPublished = v.includes("published");
  const waiting = v.some((s) => s === "queued" || s === "publishing");
  if (anyPublished && !waiting) return { key: "published", label: "Published" };
  if (!anyPublished && v.includes("failed") && !waiting) return { key: "failed", label: "Failed" };
  if (p.status === "published" && !waiting) return { key: "published", label: "Published" };
  if (p.status === "scheduled") return { key: "scheduled", label: "Scheduled" };
  return { key: "draft", label: "Draft" };
}

/** The real post on the network, once it has gone out. Null while scheduled or on failure. */
export function livePostUrl(p: PostLike): string | null {
  const hit = p.variants.find((v) => v.status === "published" && typeof v.url === "string" && /^https?:\/\//.test(v.url));
  return hit?.url ?? null;
}

export type FunnelStage = { stage: string; actual: number; target: number | null };

/** Stage furthest below its goal, by percent of goal. Null when no stage has a goal, so nothing is guessed. */
export function weakestStage(stages: FunnelStage[]): { stage: string; pct: number; actual: number; target: number } | null {
  let worst: { stage: string; pct: number; actual: number; target: number } | null = null;
  for (const s of stages) {
    if (s.target == null || s.target <= 0) continue;
    const pct = Math.round((s.actual / s.target) * 100);
    if (!worst || pct < worst.pct) worst = { stage: s.stage, pct, actual: s.actual, target: s.target };
  }
  return worst;
}

/** Share of the previous stage that moved on, as a whole percent. Null when the previous stage is zero. */
export function stepRatioPct(prev: number, next: number): number | null {
  if (prev <= 0) return null;
  return Math.round((next / prev) * 100);
}
