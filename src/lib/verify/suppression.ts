// Contact finder suppression gate. A contact who opted out (crm_contacts.suppressed,
// or their email in marketing_unsubscribes) is never looked up, and no found value
// is written to them. See docs/contact-finder-spec.md (D6).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const SUPPRESSED_REASON = "Contact opted out. Not looked up.";

export interface SuppressionInput {
  email: string | null;
  suppressed?: boolean | null;
}

/** True when this contact must not be looked up or enriched. */
export async function isSuppressed(db: Db, c: SuppressionInput): Promise<boolean> {
  if (c.suppressed) return true;
  const raw = (c.email ?? "").trim();
  const email = raw.toLowerCase();
  if (!email) return false;
  // Unsubscribes are stored lowercased by the admin route; match the raw form too.
  const { data, error } = await db
    .from("marketing_unsubscribes")
    .select("email")
    .in("email", Array.from(new Set([email, raw])))
    .limit(1);
  // Fail closed: if we can't read the unsubscribe list, don't look the person up.
  if (error) return true;
  return Array.isArray(data) && data.length > 0;
}

/** Bulk form for batch runs: the subset of emails present in marketing_unsubscribes. */
export async function unsubscribedEmails(db: Db, emails: (string | null)[]): Promise<Set<string>> {
  const trimmed = emails.map((e) => (e ?? "").trim()).filter(Boolean);
  const list = Array.from(new Set([...trimmed, ...trimmed.map((e) => e.toLowerCase())]));
  const out = new Set<string>();
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const { data, error } = await db.from("marketing_unsubscribes").select("email").in("email", chunk);
    if (error) throw new Error(`Could not read the unsubscribe list: ${error.message}`);
    for (const r of (data ?? []) as { email: string | null }[]) if (r.email) out.add(r.email.trim().toLowerCase());
  }
  return out;
}
