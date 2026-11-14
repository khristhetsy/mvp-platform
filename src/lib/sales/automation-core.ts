// Pure rules for the hybrid CRM automation. No database access here, so the
// matching, wording and link detection can be tested on their own.

export const AUTOMATION_TRIGGERS = [
  { key: "meeting_scheduled", label: "Meeting scheduled" },
  { key: "proposal_sent", label: "Proposal sent" },
  { key: "invite_sent", label: "Signup invite sent" },
  { key: "signed_up", label: "Account signed up" },
  { key: "payment_received", label: "Payment received" },
  { key: "signed_up_unpaid", label: "Signed up, not paid after the wait" },
] as const;

export type TriggerKey = (typeof AUTOMATION_TRIGGERS)[number]["key"];

export const TRIGGER_KEYS: TriggerKey[] = AUTOMATION_TRIGGERS.map((t) => t.key);

export function isTriggerKey(v: unknown): v is TriggerKey {
  return typeof v === "string" && (TRIGGER_KEYS as string[]).includes(v);
}

export function triggerLabel(key: string): string {
  return AUTOMATION_TRIGGERS.find((t) => t.key === key)?.label ?? key;
}

export type RuleShape = {
  triggers: string[];
  match_mode: "any" | "all";
  from_stage_ids: string[];
};

/**
 * A rule fires when the event that just happened is one of its triggers and,
 * for "all" rules, every other trigger has already happened for this contact.
 */
export function ruleMatches(rule: RuleShape, fired: TriggerKey, seen: ReadonlySet<string>): boolean {
  if (!rule.triggers.includes(fired)) return false;
  if (rule.match_mode === "all") return rule.triggers.every((t) => t === fired || seen.has(t));
  return true;
}

/** An empty "only if currently in" list means any stage. */
export function fromAllows(rule: Pick<RuleShape, "from_stage_ids">, currentStageId: string | null): boolean {
  if (rule.from_stage_ids.length === 0) return true;
  return currentStageId != null && rule.from_stage_ids.includes(currentStageId);
}

/** Plain English reason stored with every suggestion and every automatic move. */
export function reasonText(rule: Pick<RuleShape, "triggers" | "match_mode">, fired: TriggerKey): string {
  const labels = rule.triggers.map((t) => triggerLabel(t).toLowerCase());
  if (rule.match_mode === "all" && labels.length > 1) return `all of these happened: ${labels.join(" and ")}`;
  return `${triggerLabel(fired).toLowerCase()}`;
}

/**
 * True when text holds a link to the signup page (/start) on one of our own hosts.
 * Marketing links such as /start-something or other sites do not count.
 */
export function containsSignupLink(text: string | null | undefined, hosts: string[]): boolean {
  if (!text) return false;
  const wanted = new Set(hosts.map((h) => h.toLowerCase().replace(/^www\./, "")).filter(Boolean));
  const re = /https?:\/\/([a-z0-9.-]+)(?::\d+)?\/start(?![\w-])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (wanted.has(m[1].toLowerCase().replace(/^www\./, ""))) return true;
  }
  return false;
}
