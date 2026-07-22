// Placeholder-schema model + validation for MJML masters (build spec §3, §4, §8).
//
// The editor form is generated FROM a master's placeholder_schema — fields are
// never hardcoded, so a new master with new slots works with zero UI changes.
// These validators back the build:emails guardrails.

export type SlotType = "text" | "textarea" | "url" | "image";

export type TemplateSlot = {
  key: string;
  type: SlotType;
  label: string;
  max_length?: number;
  required?: boolean;
  /** Only the banner slot is editable brand-wise; everything else is content. */
  editable?: boolean;
};

export type PlaceholderSchema = {
  slots: TemplateSlot[];
  /** Locked layers the editor must never expose (logo, colours, footer, etc.). */
  locked: string[];
};

/**
 * Per-recipient tokens merged by the send layer, not by the editor. They are
 * legitimately present in a master without a matching slot, so schema validation
 * must not flag them as "unknown".
 */
export const SEND_TIME_TOKENS = [
  "unsubscribe_url",
  "view_in_browser_url",
  "first_name",
  "last_name",
  "company",
  "email",
] as const;

/** Tokens that MUST appear in every compiled master (mandatory footer, §8). */
export const REQUIRED_FOOTER_TOKENS = ["unsubscribe_url"] as const;

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Every distinct `{{token}}` referenced in an MJML/HTML string. */
export function extractTokens(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(TOKEN_RE)) found.add(m[1].toLowerCase());
  return [...found];
}

export type SchemaValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Guardrail for `npm run build:emails` (§4 step 2, §8):
 *  - every `{{slot}}` used in the MJML must exist in the schema (or be a
 *    known send-time token), otherwise the editor can't populate it;
 *  - every mandatory footer token must be present, otherwise the master ships
 *    without a compliant unsubscribe.
 * Returns all problems at once so a build failure lists everything to fix.
 */
export function validateMasterAgainstSchema(mjmlSource: string, schema: PlaceholderSchema): SchemaValidationResult {
  const errors: string[] = [];
  const known = new Set<string>([
    ...schema.slots.map((s) => s.key.toLowerCase()),
    ...schema.locked.map((l) => l.toLowerCase()),
    ...SEND_TIME_TOKENS.map((t) => t.toLowerCase()),
  ]);

  const used = extractTokens(mjmlSource);
  for (const token of used) {
    if (!known.has(token)) {
      errors.push(`Template uses {{${token}}} but no slot, locked layer, or send-time token defines it.`);
    }
  }

  for (const required of REQUIRED_FOOTER_TOKENS) {
    if (!used.includes(required)) {
      errors.push(`Template is missing the mandatory footer token {{${required}}} — every master must carry an unsubscribe link.`);
    }
  }

  // A required content slot that never appears in the template can never be
  // filled — catch the authoring mistake at build time.
  for (const slot of schema.slots) {
    if (slot.required && !used.includes(slot.key.toLowerCase())) {
      errors.push(`Schema marks "${slot.key}" required, but {{${slot.key}}} never appears in the template.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
