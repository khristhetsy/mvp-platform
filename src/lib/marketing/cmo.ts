/**
 * AI CMO — generates a structured, editable marketing strategy draft.
 * Routes through the shared Claude helper (src/lib/claude.ts) and degrades
 * gracefully when ANTHROPIC_API_KEY is absent (returns a usable starter draft
 * flagged isDemo). Grounded in the workspace's real contact/campaign signals
 * so suggestions aren't generic boilerplate.
 */
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { marketingDb } from "./db";
import type {
  CmoPlanDraft,
  MarketingPlanItemChannel,
  MarketingPlanItemPriority,
} from "./types";

const VALID_CHANNELS: MarketingPlanItemChannel[] = [
  "email",
  "content",
  "social",
  "paid",
  "events",
  "pr",
  "seo",
  "partnerships",
  "other",
];
const VALID_PRIORITIES: MarketingPlanItemPriority[] = ["low", "medium", "high"];

export type CmoBrief = {
  /** What the user wants this plan to achieve (free text). */
  goal: string;
  /** Optional planning window, e.g. "Q3 2026" or "next 90 days". */
  timeframe?: string;
  /** Optional budget guidance, e.g. "$25k/mo". */
  budget?: string;
};

type MarketingSignals = {
  totalContacts: number;
  newContacts30d: number;
  sent30d: number;
  opened30d: number;
  clicked30d: number;
  topLists: string[];
};

/** Pull lightweight, non-PII signals to ground the recommendation. */
async function gatherSignals(): Promise<MarketingSignals> {
  const db = marketingDb();
  const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  try {
    const [
      { count: totalContacts },
      { count: newContacts30d },
      { count: sent30d },
      { count: opened30d },
      { count: clicked30d },
      { data: lists },
    ] = await Promise.all([
      db.from("marketing_contacts").select("*", { count: "exact", head: true }),
      db
        .from("marketing_contacts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since30d),
      db
        .from("marketing_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "sent")
        .gte("occurred_at", since30d),
      db
        .from("marketing_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "opened")
        .gte("occurred_at", since30d),
      db
        .from("marketing_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "clicked")
        .gte("occurred_at", since30d),
      db.from("marketing_lists").select("name").limit(8),
    ]);
    return {
      totalContacts: totalContacts ?? 0,
      newContacts30d: newContacts30d ?? 0,
      sent30d: sent30d ?? 0,
      opened30d: opened30d ?? 0,
      clicked30d: clicked30d ?? 0,
      topLists: (lists ?? [])
        .map((l: { name: string }) => l.name)
        .filter(Boolean),
    };
  } catch {
    return {
      totalContacts: 0,
      newContacts30d: 0,
      sent30d: 0,
      opened30d: 0,
      clicked30d: 0,
      topLists: [],
    };
  }
}

function fallbackDraft(brief: CmoBrief): CmoPlanDraft {
  return {
    name: brief.goal.slice(0, 80) || "Marketing plan",
    objective: brief.goal,
    summary:
      "AI CMO drafting is not configured (set ANTHROPIC_API_KEY to enable). " +
      "This is a starter outline you can edit. Each initiative can be pushed to Tasks.",
    target_audience: "Define your primary audience and ICP here.",
    budget: brief.budget ?? null,
    items: [
      {
        title: "Clarify positioning and core message",
        description:
          "Document the value proposition, target ICP, and the single message every channel reinforces.",
        channel: "content",
        priority: "high",
      },
      {
        title: "Launch a nurture email sequence",
        description:
          "Build a 3–5 step sequence for new contacts to drive activation and replies.",
        channel: "email",
        priority: "high",
      },
      {
        title: "Establish a content cadence",
        description:
          "Ship one anchor piece per week and repurpose it across channels.",
        channel: "content",
        priority: "medium",
      },
      {
        title: "Stand up reporting on funnel metrics",
        description:
          "Track sends, opens, clicks, replies, and conversions weekly.",
        channel: "other",
        priority: "medium",
      },
    ],
    generatedBy: "unconfigured",
    isDemo: true,
  };
}

function coerceChannel(v: unknown): MarketingPlanItemChannel {
  return VALID_CHANNELS.includes(v as MarketingPlanItemChannel)
    ? (v as MarketingPlanItemChannel)
    : "other";
}
function coercePriority(v: unknown): MarketingPlanItemPriority {
  return VALID_PRIORITIES.includes(v as MarketingPlanItemPriority)
    ? (v as MarketingPlanItemPriority)
    : "medium";
}

/** Extract the first balanced JSON object from a model response. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generatePlanDraft(brief: CmoBrief): Promise<CmoPlanDraft> {
  if (!isClaudeConfigured()) {
    return fallbackDraft(brief);
  }

  const signals = await gatherSignals();

  const system =
    "You are an experienced CMO for CapitalOS, a capital operating system " +
    "platform serving startup founders and investors. Produce a concrete, " +
    "channel-specific marketing plan grounded in the workspace's real signals. " +
    "Be specific and realistic; avoid generic filler. Respond with ONLY a " +
    "valid JSON object — no prose, no markdown fences. Schema: " +
    '{"name":string,"objective":string,"summary":string,' +
    '"target_audience":string,"budget":string|null,' +
    '"items":[{"title":string,"description":string,' +
    '"channel":"email"|"content"|"social"|"paid"|"events"|"pr"|"seo"|"partnerships"|"other",' +
    '"priority":"low"|"medium"|"high"}]} . ' +
    "Return 5–8 initiatives ordered by priority.";

  const text = await claudeComplete(
    [
      {
        role: "user",
        content: JSON.stringify({
          goal: brief.goal,
          timeframe: brief.timeframe ?? "next 90 days",
          budget: brief.budget ?? "unspecified",
          workspaceSignals: signals,
        }),
      },
    ],
    { model: CLAUDE_SONNET, maxTokens: 2048, temperature: 0.7, system },
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(text) as Record<string, unknown>;
  } catch {
    // Model returned something unparseable — fall back rather than throw.
    const fb = fallbackDraft(brief);
    fb.summary =
      "The AI response could not be parsed into a plan. Showing a starter outline you can edit.";
    return fb;
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return {
        title: String(o.title ?? "").trim(),
        description: String(o.description ?? "").trim(),
        channel: coerceChannel(o.channel),
        priority: coercePriority(o.priority),
      };
    })
    .filter((it) => it.title.length > 0);

  return {
    name: String(parsed.name ?? brief.goal).slice(0, 120) || "Marketing plan",
    objective: String(parsed.objective ?? brief.goal),
    summary: String(parsed.summary ?? ""),
    target_audience: String(parsed.target_audience ?? ""),
    budget:
      parsed.budget == null ? (brief.budget ?? null) : String(parsed.budget),
    items: items.length > 0 ? items : fallbackDraft(brief).items,
    generatedBy: "claude",
    isDemo: false,
  };
}
