import type { CollaborationMention } from "@/lib/collaboration/types";

const MENTION_PATTERN = /@([a-zA-Z0-9_.-]{1,64})/g;

export function parseMentions(body: string): CollaborationMention[] {
  const mentions: CollaborationMention[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const label = match[1];
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    mentions.push({ type: "user", label, userId: null });
  }

  return mentions.slice(0, 20);
}
