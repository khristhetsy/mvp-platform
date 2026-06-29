// AI campaign-kit generator. Drafts the marketing kit (SEO, brochure, email,
// social) from REAL event data only. Compliance-guarded like the Info Desk:
// this is an educational community event, never an offer of securities. Falls
// back to a deterministic template when Claude isn't configured.

import { CLAUDE_SONNET, claudeComplete, isClaudeConfigured, type ClaudeMessage } from "@/lib/claude";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventWithDetail } from "@/lib/icfo-events/types";
import {
  emptyMarketing,
  type Brochure,
  type EmailInvite,
  type EventMarketing,
  type SocialDrafts,
} from "@/lib/icfo-events/marketing";

const SYSTEM = `You are the iCFO Events marketing copywriter. You draft promotional copy for a virtual ecosystem showcase that convenes founders and investors for education and community.

Hard rules:
- This is an educational community event, NOT an offer, solicitation, or recommendation of any security, deal, fund, or company to invest in. Never imply guaranteed returns, fundraising outcomes, or that attending leads to investment. Never use words like "invest now", "returns", "guaranteed", or name a security.
- Use ONLY the event facts provided. Never invent speakers, sponsors, prices, statistics, dates, or sessions.
- Warm, credible, concise. No emoji in SEO or email subject. At most light, tasteful emoji in social posts.
- Output STRICT JSON only — no markdown, no commentary, no code fences.`;

interface KitInput {
  tone?: string;
}

function context(event: EventWithDetail): string {
  const lines: string[] = [];
  lines.push(`Title: ${event.title}`);
  if (event.summary) lines.push(`Summary: ${event.summary}`);
  lines.push(`Format: ${event.format.replace("_", " ")}`);
  if (event.startsAt) lines.push(`Starts: ${new Date(event.startsAt).toLocaleString()}`);
  if (event.endsAt) lines.push(`Ends: ${new Date(event.endsAt).toLocaleString()}`);
  if (event.sectors.length) {
    lines.push(`Sector tracks: ${event.sectors.map((s) => s.label || sectorLabel(s.sectorSlug)).join(", ")}`);
  }
  const sessions = event.sessions.filter((s) => s.status !== "draft").slice(0, 10);
  if (sessions.length) {
    lines.push("Agenda highlights:");
    for (const s of sessions) lines.push(`- ${s.title}${s.sectorSlug ? ` (${sectorLabel(s.sectorSlug)})` : ""}`);
  }
  return lines.join("\n");
}

const JSON_SHAPE = `{
  "seoTitle": "string (<= 60 chars)",
  "seoDescription": "string (140-160 chars)",
  "seoKeywords": "comma-separated keywords",
  "brochure": { "headline": "string", "subhead": "string", "body": "2-3 short paragraphs", "highlights": ["3-5 bullet strings"], "cta": "short call to action" },
  "email": { "subject": "string", "preheader": "string", "body": "invitation email, plain text, 3-5 short paragraphs ending with a register CTA" },
  "social": { "linkedin": "professional post", "facebook": "friendly post", "instagram": "short visual caption with a few hashtags" }
}`;

/** Strip code fences / prose and parse the first JSON object found. */
function parseKit(text: string): Partial<EventMarketing> | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    const brochure = (o.brochure ?? {}) as Partial<Brochure>;
    const email = (o.email ?? {}) as Partial<EmailInvite>;
    const social = (o.social ?? {}) as Partial<SocialDrafts>;
    return {
      seoTitle: String(o.seoTitle ?? ""),
      seoDescription: String(o.seoDescription ?? ""),
      seoKeywords: String(o.seoKeywords ?? ""),
      brochure: {
        headline: String(brochure.headline ?? ""),
        subhead: String(brochure.subhead ?? ""),
        body: String(brochure.body ?? ""),
        highlights: Array.isArray(brochure.highlights) ? brochure.highlights.map(String) : [],
        cta: String(brochure.cta ?? ""),
      },
      email: {
        subject: String(email.subject ?? ""),
        preheader: String(email.preheader ?? ""),
        body: String(email.body ?? ""),
      },
      social: {
        linkedin: String(social.linkedin ?? ""),
        facebook: String(social.facebook ?? ""),
        instagram: String(social.instagram ?? ""),
      },
    };
  } catch {
    return null;
  }
}

/** Deterministic kit from real fields — used when Claude is unavailable. */
function fallbackKit(event: EventWithDetail): EventMarketing {
  const kit = emptyMarketing();
  const sectors = event.sectors.map((s) => s.label || sectorLabel(s.sectorSlug));
  const when = event.startsAt ? new Date(event.startsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "soon";
  const summary = event.summary ?? `An iCFO Events ecosystem showcase convening founders and investors${sectors.length ? ` across ${sectors.join(", ")}` : ""}.`;

  kit.seoTitle = `${event.title} — iCFO Events`.slice(0, 60);
  kit.seoDescription = summary.slice(0, 158);
  kit.seoKeywords = ["iCFO Events", "founders", "investors", "startup showcase", ...sectors].join(", ");
  kit.brochure = {
    headline: event.title,
    subhead: `A virtual ecosystem showcase · ${when}`,
    body: summary,
    highlights: [
      ...(sectors.length ? [`Sector tracks: ${sectors.join(", ")}`] : []),
      "Live sessions on the Main Stage",
      "Talk shows and founder showcases",
      "Networking lounge to meet founders and investors",
    ].slice(0, 5),
    cta: "Register to attend",
  };
  kit.email = {
    subject: `You're invited: ${event.title}`,
    preheader: `Join us ${when} for an iCFO Events showcase.`,
    body: `Hello,\n\nYou're invited to ${event.title}, a virtual iCFO Events showcase on ${when}.\n\n${summary}\n\nThis is an educational community event — a chance to learn and meet others in the ecosystem. Register to save your spot.\n\nSee you there,\nThe iCFO Events team`,
  };
  kit.social = {
    linkedin: `We're hosting ${event.title} on ${when} — a virtual iCFO Events showcase${sectors.length ? ` spanning ${sectors.join(", ")}` : ""}. An educational community event for founders and investors. Register to attend.`,
    facebook: `${event.title} is coming ${when}! Join our virtual showcase for founders and investors. Register to attend.`,
    instagram: `${event.title} · ${when} 🎤 A virtual showcase for the founder + investor community. Link in bio to register. #iCFOEvents #startups #founders`,
  };
  return kit;
}

/** Generate a full marketing kit for an event. */
export async function generateCampaignKit(event: EventWithDetail, input: KitInput = {}): Promise<EventMarketing> {
  if (!isClaudeConfigured()) return fallbackKit(event);
  try {
    const messages: ClaudeMessage[] = [
      {
        role: "user",
        content: `Draft a complete marketing kit for this event.${input.tone ? ` Desired tone: ${input.tone}.` : ""}\n\nEVENT FACTS:\n${context(event)}\n\nReturn JSON exactly in this shape:\n${JSON_SHAPE}`,
      },
    ];
    const text = await claudeComplete(messages, { model: CLAUDE_SONNET, maxTokens: 1600, system: SYSTEM, locale: "en" });
    const parsed = parseKit(text);
    if (!parsed) return fallbackKit(event);
    return { ...emptyMarketing(), ...parsed };
  } catch {
    return fallbackKit(event);
  }
}
