/**
 * Free drafting for founder social media. Rule based text only: templates filled from
 * the founder's own notes and company name, plus text transforms. It never calls a paid
 * AI service, and this file must not import "@/lib/claude" or "@/lib/social/composer"
 * (composer pulls in the paid client). Founder routes use only this module.
 */

export const FOUNDER_SOCIAL_DISCLAIMER =
  "iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

export const TEMPLATE_KEYS = ["investor_update", "milestone", "hiring", "product_launch", "event"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  investor_update: "Investor update",
  milestone: "Milestone",
  hiring: "Hiring",
  product_launch: "Product launch",
  event: "Event",
};

export const NETWORKS = ["linkedin", "facebook", "instagram", "reddit"] as const;
export type Network = (typeof NETWORKS)[number];

/** Practical per post character ceilings used by Shorten and Variants. */
export const NETWORK_LIMITS: Record<Network, number> = { linkedin: 3000, facebook: 2000, instagram: 2200, reddit: 2000 };

export type DraftInput = { notes: string; company?: string | null };

/** Split free notes into clean lines: one idea per line, bullets and numbering removed. */
export function noteLines(notes: string): string[] {
  return notes
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function bullets(lines: string[]): string {
  return lines.map((l) => `• ${l.replace(/[.]+$/, "")}`).join("\n");
}

/** Replace dash punctuation so drafts follow house style (commas and periods only). */
export function plainPunctuation(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/\s+-\s+/g, ", ");
}

export function draftFromTemplate(key: TemplateKey, input: DraftInput): string {
  const co = input.company?.trim() || "our company";
  const lines = noteLines(input.notes);
  const [first, ...rest] = lines;
  const lead = first ? first.replace(/[.]+$/, "") : "";
  const body = rest.length ? `\n\n${bullets(rest)}` : "";
  switch (key) {
    case "investor_update":
      return plainPunctuation(`Update from ${co}.\n\n${lead || "Here is where we are this month"}.${body}\n\nIf this is relevant to what you invest in, I would value a conversation.`);
    case "milestone":
      return plainPunctuation(`A milestone at ${co}: ${lead || "we reached something worth sharing"}.${body}\n\nThank you to everyone who got us here. More to come.`);
    case "hiring":
      return plainPunctuation(`${co} is hiring.\n\n${lead || "We are growing the team"}.${body}\n\nKnow someone who fits? Send them my way.`);
    case "product_launch":
      return plainPunctuation(`Now live at ${co}: ${lead || "our latest release"}.${body}\n\nTry it and tell us what you think.`);
    case "event":
      return plainPunctuation(`${co} at an upcoming event.\n\n${lead || "Details below"}.${body}\n\nIf you will be there, let us connect.`);
  }
}

/** Cut to a character limit on a sentence or line boundary where possible. */
export function shorten(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  const clean = boundary > max * 0.5 ? cut.slice(0, boundary + 1) : cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max);
  return clean.trimEnd();
}

const STOP = new Set(["the", "and", "for", "with", "our", "this", "that", "are", "was", "has", "have", "from", "your", "you", "will", "new", "now", "more", "about", "into", "their"]);

/** Up to `n` hashtags from the most distinct words in the text. */
export function suggestHashtags(text: string, n = 4): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) ?? []) {
    if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n);
  return ranked.map(([w]) => `#${w}`);
}

export function addHashtags(text: string, n = 4): string {
  if (/#[a-z0-9]+/i.test(text)) return text;
  const tags = suggestHashtags(text, n);
  return tags.length ? `${text.trimEnd()}\n\n${tags.join(" ")}` : text;
}

/** One rewrite per network, never identical copy across accounts. */
export function variantsPerNetwork(text: string, networks: Network[]): Record<Network, string> {
  const out = {} as Record<Network, string>;
  for (const n of networks) {
    switch (n) {
      case "linkedin":
        out[n] = shorten(text, NETWORK_LIMITS.linkedin);
        break;
      case "facebook":
        out[n] = shorten(text.replace(/\n{3,}/g, "\n\n"), NETWORK_LIMITS.facebook);
        break;
      case "instagram":
        out[n] = addHashtags(shorten(text, NETWORK_LIMITS.instagram - 60), 5);
        break;
      case "reddit":
        out[n] = shorten(text.replace(/#[a-z0-9]+/gi, "").replace(/\n{3,}/g, "\n\n").trim(), NETWORK_LIMITS.reddit);
        break;
    }
  }
  return out;
}

/** Plain advice for "What to post next" when no paid AI is involved. */
export type FunnelWeakness = { weakestStage: "outreach" | "clicks" | "meetings" | "intros" | null };

export function nextPostTip(w: FunnelWeakness): string {
  switch (w.weakestStage) {
    case "outreach": return "You are not posting often enough. Schedule a recurring weekly update so the next month keeps its pace.";
    case "clicks": return "Posts are going out but few people click. Lead with one concrete result and put your tracked link in the first comment.";
    case "meetings": return "Clicks are on track but meetings are behind. Try a post with a direct ask to book 20 minutes, and pin your calendar link as the first comment.";
    case "intros": return "Meetings are happening but few turn into investor intros. Follow up each meeting with a short update post and an email to the contacts you met.";
    default: return "Your funnel is on pace. Keep the weekly rhythm and reuse your best post from the Library.";
  }
}
