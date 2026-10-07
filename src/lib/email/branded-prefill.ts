// Prefill for a new branded template opened from an Investor Relations project:
// the founder's answers (the Odoo questionnaire on the founder contact, or the
// linked iCapOS company) mapped onto the Deal introduction fields, plus the
// banner from that company's last branded template. Each value carries the
// source it came from so the editor can tag it. Read only: nothing is written
// back to the founder record.

import { db, entrepreneurProfile, getProject } from "@/lib/ir/db";

export type FounderPrefill = {
  /** "Bruce Kehr · Holo MD" */
  label: string;
  values: Record<string, string>;
  /** Field key → where the value came from. */
  sources: Record<string, string>;
  /** Founder's website, used when no booking link is saved. */
  website: string | null;
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const asText = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v.join(", ") : v ?? "").trim();

/** "Raise-2.5-Mil-Revenue-150-200K" → "$2.5M"; null when no amount is written. */
export function raiseFromRequest(request: string): string | null {
  const m = request.match(/raise[^0-9$]*\$?\s*([\d.,]+)\s*[-\s]*(million|mil|mm|m|k)?\b/i);
  if (!m) return null;
  const n = m[1].replace(/,/g, "");
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("m")) return `$${n}M`;
  if (unit === "k") return `$${n}K`;
  return `$${Number(n).toLocaleString("en-US")}`;
}

/** "1. A ... 2. B ..." → "A ...\nB ..."; text without numbering is returned as is. */
export function splitNumbered(text: string): string {
  const parts = text.split(/(?:^|\s)\d+\.\s+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.join("\n") : text.trim();
}

export async function founderPrefill(projectId: string): Promise<FounderPrefill | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const ep = await entrepreneurProfile(project);
  const rows = new Map((ep.odoo?.sections ?? []).flatMap((s) => s.rows).map((r) => [r.label, asText(r.value)]));
  const q = (label: string) => rows.get(label) ?? "";

  type CompanyText = { business_description: string | null; use_of_funds: string | null };
  const company: CompanyText | null = ep.companyId
    ? (((await db().from("companies").select("business_description, use_of_funds").eq("id", ep.companyId).maybeSingle()).data ?? null) as CompanyText | null)
    : null;

  const values: Record<string, string> = {};
  const sources: Record<string, string> = {};
  const put = (key: string, value: string | null | undefined, source: string) => {
    const v = (value ?? "").trim();
    if (v) { values[key] = v; sources[key] = source; }
  };

  const name = (ep.company ?? "").trim();
  put("company_name", name, "Company Name");
  if (name) put("headline", `Introducing ${name}`, "Company Name");
  put("body", company?.business_description || q("Business summary"), company?.business_description ? "Company description" : "Business summary");
  const highlights = q("Five key highlights");
  put("considerations", highlights ? splitNumbered(highlights) : "", "Five key highlights");

  const terms: string[] = [];
  const raise = raiseFromRequest(q("Entrepreneur's request")) ?? ep.raise ?? (q("Seeking amount of capital") || null);
  if (raise) terms.push(`Raise: ${raise}`);
  if (q("Funding stage")) terms.push(`Funding stage: ${q("Funding stage")}`);
  if (q("Seeking type(s) of capital")) terms.push(`Capital type: ${q("Seeking type(s) of capital")}`);
  if (q("Annual revenue size")) terms.push(`Revenue: ${q("Annual revenue size")}`);
  const uof = company?.use_of_funds || q("Use of funds");
  if (uof) terms.push(`Use of funds: ${uof}`);
  put("terms", terms.join("\n"), "Questionnaire");

  // Banner: the latest branded template made for this company.
  if (name) {
    const { data } = await db()
      .from("email_template_copies")
      .select("name, slot_values")
      .order("updated_at", { ascending: false })
      .limit(200);
    const hit = ((data ?? []) as Array<{ name: string; slot_values: Record<string, string> | null }>).find(
      (c) => (c.slot_values?.hero_image ?? "").trim() && squash(c.slot_values?.company_name ?? "") === squash(name),
    );
    if (hit) put("hero_image", hit.slot_values!.hero_image, hit.name);
  }

  const founder = (ep.founder ?? project.founder_name ?? "").trim();
  return { label: [founder, name].filter(Boolean).join(" · "), values, sources, website: ep.website ?? null };
}
