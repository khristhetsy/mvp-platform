/**
 * Shapes the "Reach out to founder" draft for a blocking stage around what the founder
 * has to do, from the findings the stage diagnosis already computed.
 *
 * Findings arrive as flat lines. Fix lines look like
 *   `Fix (1 of 2) [Founder · Outreach › Manual @ Outreach]: Founder adds recipients …`
 * Everything else is status (headline, problem, missing rows). Pure functions, no I/O.
 */

export type ReachOutAction = {
  text: string;
  /** Menu item in iCapOS, from the finding's owner or menu label; null when unknown. */
  where: string | null;
  /** "+9", "gate", "1 of 2" … what the step is worth. */
  impact: string;
};

export type ReachOutBrief = {
  /** Steps the founder does, highest impact first. */
  actions: ReachOutAction[];
  /** Things that happen on their own once the actions are done (owner Downstream). */
  follows: string[];
  /** Status lines: headline and problem text, cleared items included. */
  status: string[];
};

const FIX = /^Fix \(([^)]*)\) \[([^\]]*)\]: (.*)$/;

function ownerParts(owner: string): { who: string; where: string | null } {
  const [who, menu] = owner.split(" @ ");
  // "Founder · Outreach › Manual" carries its own path; "Founder" alone falls back to the menu item.
  const path = who.includes(" · ") ? who.split(" · ").slice(1).join(" · ") : null;
  return { who: who.trim(), where: path ?? (menu ? menu.trim() : null) };
}

/** Rank by what the step is worth: gate first, then points, then "n of m", then the rest. */
function impactRank(impact: string): number {
  if (impact === "gate") return 1000;
  const pts = /^\+(\d+)/.exec(impact);
  if (pts) return Number(pts[1]);
  const of = /^(\d+) of (\d+)/.exec(impact);
  if (of) return 100 * (Number(of[1]) / Math.max(1, Number(of[2])));
  return 0;
}

export function splitFindings(facts: string[]): ReachOutBrief {
  const actions: ReachOutAction[] = [];
  const follows: string[] = [];
  const status: string[] = [];
  for (const line of facts) {
    const m = FIX.exec(line);
    if (!m) {
      status.push(line);
      continue;
    }
    const [, impact, owner, text] = m;
    const { who, where } = ownerParts(owner);
    const w = who.toLowerCase();
    if (w.startsWith("founder") || w === "staff or founder") {
      actions.push({ text, where, impact });
    } else if (w === "downstream") {
      follows.push(text);
    }
    // Automatic, Staff, Reminders, Templated request, "Once wired", "To measure it":
    // nothing for the founder to do, so they do not go in the founder's email.
  }
  actions.sort((a, b) => impactRank(b.impact) - impactRank(a.impact));
  return { actions, follows, status };
}

/** Next Friday in the founder's zone, as "Friday, Oct 24". Today being Friday counts as this week. */
export function nextFridayLabel(now: Date, iana: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: iana });
  const day = new Date(now);
  for (let i = 0; i < 7; i += 1) {
    if (fmt.format(day) === "Fri" && (i > 0 || hourIn(day, iana) < 15)) break;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: iana }).format(day);
}

function hourIn(d: Date, iana: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: iana }).format(d));
}

const VERBS: Record<string, string> = { adds: "add", sends: "send", opens: "open", uploads: "upload", runs: "run", completes: "complete", fills: "fill", requests: "request", improves: "improve", walks: "walk" };

/** "Founder adds recipients (…) and sends the first email." → "Add recipients and send the first email". */
function imperative(s: string): string {
  const first = s.split(/(?<=\.)\s/)[0].replace(/\s*\([^)]*\)/g, "").replace(/\.$/, "").replace(/\s+—.*$/, "");
  const noSubject = first.replace(/^Founder\s+/, "");
  const verbed = noSubject.replace(/(^|\band\s+)(\w+)/g, (m, lead: string, v: string) => lead + (VERBS[v.toLowerCase()] ?? v));
  return verbed.charAt(0).toUpperCase() + verbed.slice(1);
}

/** Subject names the first action; one action reads as "one thing", more as "N things". */
export function blockingSubject(first: string, brief: ReachOutBrief, stage: string): string {
  if (!brief.actions.length) return `A couple of things blocking your iCapOS ${stage}`;
  const n = brief.actions.length;
  const lead = n === 1 ? "one thing to do this week" : `${n} things to do this week`;
  return `${first}, ${lead}: ${imperative(brief.actions[0].text).replace(/^./, (c) => c.toLowerCase())}`;
}

/** The email when Claude is not configured, in the same shape the model is asked for. */
export function blockingFallbackBody(first: string, brief: ReachOutBrief, stage: string, dueLabel: string): string {
  const lines: string[] = [`Hi ${first},`, ""];
  const holding = brief.actions.length === 1 ? "One thing is holding" : `${brief.actions.length || "A few"} things are holding`;
  lines.push(`${holding} your ${stage} stage.`, "", "What needs to get done");
  if (brief.actions.length) {
    brief.actions.forEach((a, i) => lines.push(`${i + 1}. ${imperative(a.text)}.${a.where ? ` Where: ${a.where}.` : ""} Worth: ${a.impact}.`));
  } else {
    lines.push("1. Finish the remaining steps in this stage.");
  }
  if (brief.follows.length) {
    lines.push("", "What follows on its own");
    brief.follows.forEach((f) => lines.push(`- ${f}`));
  }
  lines.push("", `Can you get item 1 done by ${dueLabel}? Reply with a date, or with whatever is in the way, and we will clear it.`);
  return lines.join("\n");
}

/** The user turn for the model, blocking situation only. */
export function blockingPrompt(input: {
  founderName: string;
  companyName: string;
  stage: string;
  brief: ReachOutBrief;
  dueLabel: string;
}): string {
  const { brief } = input;
  const actions = brief.actions.length
    ? brief.actions.map((a, i) => `${i + 1}. ${a.text}${a.where ? ` (where: ${a.where})` : ""} (worth: ${a.impact})`).join("\n")
    : "none listed";
  return (
    `Write an email to ${input.founderName} at ${input.companyName}, a founder on the iCapOS fundraising platform. Stage: ${input.stage}. The stage is blocking.\n\n` +
    `Structure, in this order:\n` +
    `1. Greeting, then ONE line on where they stand (use the status facts; no congratulations paragraph).\n` +
    `2. A heading "What needs to get done", then the numbered steps below, in the given order, one per line. ` +
    `Each step: the action in the founder's own terms, where in iCapOS it happens in the form "Menu › Item", and what it is worth, using the figures given.\n` +
    (brief.follows.length ? `3. A heading "What follows on its own", one short line each for the follow-on items. No action verb for the founder there.\n` : "") +
    `${brief.follows.length ? 4 : 3}. One closing ask: get step 1 done by ${input.dueLabel}, and reply with a date or with what is in the way.\n\n` +
    `Steps the founder has to do (highest value first):\n${actions}\n\n` +
    (brief.follows.length ? `Follows on its own once the steps are done:\n${brief.follows.map((f) => `- ${f}`).join("\n")}\n\n` : "") +
    `Status facts (for the one line on where they stand only):\n${brief.status.map((s) => `- ${s}`).join("\n") || "- none"}\n\n` +
    `Rules: 90 to 130 words. Plain text, no markdown. Use the real numbers given; never say "some items are pending". ` +
    `Do not mention reminders, staff steps or how the platform measures things. No sign-off block (a signature is appended). ` +
    `Warm and direct; no funding promises.`
  );
}
