/**
 * Step-by-step guides for the support desk: a short checklist per topic that
 * shows beside a ticket, so whoever picks it up follows the same steps.
 *
 * Defaults live here; staff edits are saved as one JSON row in
 * `platform_settings` (key `support_guides`) and win over the defaults.
 * Topics match a request's context_item (the tool the founder asked from),
 * falling back to the AI triage topic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const SUPPORT_GUIDES_KEY = "support_guides";

export type SupportGuide = { topic: string; title: string; steps: string[] };

export const DEFAULT_GUIDES: SupportGuide[] = [
  {
    topic: "Financial model",
    title: "Financial model question",
    steps: [
      "Open the founder's company and their financial model",
      "Check the raise amount matches the funding figure in the model",
      "Check the 5 year totals against the drivers they set",
      "Reply with what to fix and where, and link the Financial model",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Cap table",
    title: "Cap table question",
    steps: [
      "Open the founder's cap table",
      "Check total shares and ownership add up to 100%",
      "Check the modeled round matches the raise amount",
      "Reply with the fix and link the Cap table",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Business plan",
    title: "Business plan question",
    steps: [
      "Open the founder's business plan",
      "Find the section they are asking about",
      "Reply with specific edits, not general advice",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Pitch deck",
    title: "Pitch deck question",
    steps: [
      "Open the founder's pitch deck",
      "Run the Pitch deck analyzer if they have not",
      "Reply with the top two changes",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Data room",
    title: "Data room or upload problem",
    steps: [
      "Check which documents are missing in their data room",
      "Remind them uploads are PDF only",
      "If an upload failed, ask for the file name and size",
      "Reply with the next document to add",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Billing",
    title: "Plan or billing question",
    steps: [
      "Check their plan and payment status on the company page",
      "Confirm what their plan includes and their outreach limit",
      "Reply with the answer and the Billing page link",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "Assistant",
    title: "Handed off from the assistant",
    steps: [
      "Read the assistant conversation in the first message",
      "Answer the part the assistant could not",
      "Resolve and ask for a rating",
    ],
  },
  {
    topic: "General",
    title: "General question",
    steps: [
      "Read the request and check the founder's stage and plan",
      "Answer, or assign to the right person",
      "Resolve and ask for a rating",
    ],
  },
];

function normalize(raw: unknown): SupportGuide[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: SupportGuide[] = [];
  for (const g of list) {
    const row = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
    const topic = typeof row.topic === "string" ? row.topic.trim().slice(0, 80) : "";
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 120) : "";
    const steps = (Array.isArray(row.steps) ? row.steps : [])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().slice(0, 200))
      .slice(0, 12);
    if (topic && steps.length) out.push({ topic, title: title || topic, steps });
  }
  return out.slice(0, 50);
}

/** Saved guides merged over the defaults (saved ones replace a default with the same topic). */
export function mergeGuides(saved: SupportGuide[]): SupportGuide[] {
  const byTopic = new Map(DEFAULT_GUIDES.map((g) => [g.topic.toLowerCase(), g]));
  for (const g of saved) byTopic.set(g.topic.toLowerCase(), g);
  return [...byTopic.values()];
}

/** The guide for a request: its tool first, then the AI triage topic, then General. */
export function pickGuide(guides: SupportGuide[], contextItem: string | null, triageTopic: string | null): SupportGuide {
  const find = (t: string | null) => (t ? guides.find((g) => g.topic.toLowerCase() === t.trim().toLowerCase()) : undefined);
  const fuzzy = (t: string | null) =>
    t ? guides.find((g) => t.toLowerCase().includes(g.topic.toLowerCase()) && g.topic !== "General") : undefined;
  return find(contextItem) ?? find(triageTopic) ?? fuzzy(triageTopic) ?? find("General") ?? DEFAULT_GUIDES[DEFAULT_GUIDES.length - 1];
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getSupportGuides(): Promise<SupportGuide[]> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", SUPPORT_GUIDES_KEY).maybeSingle();
    return mergeGuides(normalize((data as { value?: unknown } | null)?.value));
  } catch {
    return DEFAULT_GUIDES;
  }
}

export async function saveSupportGuides(next: unknown, updatedBy: string | null): Promise<SupportGuide[] | null> {
  const clean = normalize(next);
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: SUPPORT_GUIDES_KEY, value: clean, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return error ? null : mergeGuides(clean);
  } catch {
    return null;
  }
}
