// Prospect Pipeline — Step 3: email pattern inference (free). Generates likely
// addresses from a name + company domain. GUARDRAIL: inferred addresses are
// marked risky and must never be cold-sent — they only become sendable after a
// provider verifies them.

export function inferEmails(name: string | null | undefined, domain: string | null | undefined): string[] {
  const parts = (name ?? "").trim().toLowerCase().replace(/[^a-z\s'-]/g, "").split(/\s+/).filter(Boolean);
  const d = (domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (parts.length === 0 || !d) return [];

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : null;
  const cands = new Set<string>();

  cands.add(`${first}@${d}`);
  if (last && last !== first) {
    cands.add(`${first}.${last}@${d}`);
    cands.add(`${first[0]}${last}@${d}`);
    cands.add(`${first}${last}@${d}`);
    cands.add(`${first}.${last[0]}@${d}`);
    cands.add(`${last}@${d}`);
  }
  return Array.from(cands).slice(0, 6);
}
