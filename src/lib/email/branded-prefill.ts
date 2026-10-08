// Founder data for branded templates. A template is "working on" one founder:
// an Investor Relations project (the founder's Odoo questionnaire, plus the
// linked iCapOS company when there is one) or an iCapOS founder account (the
// company profile). founderPrefill() maps that record onto the Deal
// introduction fields (other designs remap them in design.ts), lists every
// field it holds for the Founder data panel, and finds the company's last
// banner. Read only: nothing is written back to the founder record.

import { db, entrepreneurProfile, getProject } from "@/lib/ir/db";
import { TERM_FIELDS, termLine, termValue } from "./founder-fields";

export type FounderRef = { kind: "project" | "company"; id: string };
export type FounderField = { key: string; label: string; value: string };

export type FounderPrefill = {
  ref: FounderRef;
  /** "Bruce Kehr · Holo MD" */
  label: string;
  /** "Odoo questionnaire, synced Oct 6" / "iCapOS company profile" */
  source: string;
  /** Admin page for the founder record. */
  recordUrl: string;
  values: Record<string, string>;
  /** Field key → where the value came from. */
  sources: Record<string, string>;
  /** Founder's website, used when no booking link is saved. */
  website: string | null;
  /** Everything in the record, for the Founder data panel. */
  fields: FounderField[];
};

export type FounderOption = { ref: FounderRef; label: string; sub: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const asText = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v.join(", ") : v ?? "").trim();
const listText = (v: unknown) => {
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (t.startsWith("[")) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a.map(String).join(", "); } catch { /* plain text */ } }
  return t;
};
const ptDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : null;

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

/** The banner of the latest branded template made for this company. */
async function lastBanner(company: string): Promise<{ url: string; from: string } | null> {
  if (!company) return null;
  const { data } = await db().from("email_template_copies").select("name, slot_values").order("updated_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Array<{ name: string; slot_values: Record<string, string> | null }>;
  const hit = rows.find((c) => {
    const sv = c.slot_values ?? {};
    const img = (sv.hero_image || sv.banner_image || "").trim();
    return img && squash(sv.company_name || sv.headline?.replace(/^introducing\s+/i, "") || "") === squash(company);
  });
  if (!hit) return null;
  const sv = hit.slot_values ?? {};
  return { url: (sv.hero_image || sv.banner_image)!.trim(), from: hit.name };
}

type Company = Record<string, string | number | null>;
const COMPANY_COLS =
  "id, company_name, founder_id, business_description, key_highlights, website, logo_url, funding_amount, funding_amount_band, funding_stage, operating_stage, seeking_capital_types, seeking_investor_types, annual_revenue_size, annual_ebitda, revenue_stage, use_of_funds, industry, management_team, team_summary, contact_phone, country";

/** Company profile fields, labelled for the panel (key = prefill key when it feeds a field). */
export function companyFields(c: Company): FounderField[] {
  const s = (k: string) => listText(c[k]);
  const out: Array<[string, string, string]> = [
    ["company_name", "Company", s("company_name")],
    ["website", "Website", s("website")],
    ["body", "Business description", s("business_description")],
    ["considerations", "Key highlights", s("key_highlights")],
    ["raise", "Raise", c.funding_amount != null ? `$${Number(c.funding_amount).toLocaleString("en-US")}` : s("funding_amount_band")],
    ["funding_stage", "Funding stage", [s("funding_stage"), s("operating_stage") && `operating: ${s("operating_stage")}`].filter(Boolean).join(" · ")],
    ["capital_type", "Capital type", s("seeking_capital_types")],
    ["revenue", "Revenue / EBITDA", [s("annual_revenue_size") || s("revenue_stage"), s("annual_ebitda") && `EBITDA ${s("annual_ebitda")}`].filter(Boolean).join(" · ")],
    ["use_of_funds", "Use of funds", s("use_of_funds")],
    ["industries", "Industries", s("industry")],
    ["investor_types", "Investor types sought", s("seeking_investor_types")],
    ["team", "Management team", s("management_team") || s("team_summary")],
    ["country", "Country", s("country")],
    ["logo_image", "Logo", s("logo_url")],
  ];
  return out.filter(([, , v]) => v).map(([key, label, value]) => ({ key, label, value }));
}

/** Map the panel fields onto the template values every design starts from. */
export function valuesFrom(fields: FounderField[]): { values: Record<string, string>; sources: Record<string, string> } {
  const f = new Map(fields.map((x) => [x.key, x]));
  const values: Record<string, string> = {};
  const sources: Record<string, string> = {};
  const put = (key: string, value: string | undefined, source: string | undefined) => {
    const v = (value ?? "").trim();
    if (v && source) { values[key] = v; sources[key] = source; }
  };
  const company = f.get("company_name");
  put("company_name", company?.value, company?.label);
  if (company) put("headline", `Introducing ${company.value}`, company.label);
  put("body", f.get("body")?.value, f.get("body")?.label);
  const hl = f.get("considerations");
  put("considerations", hl ? splitNumbered(hl.value) : "", hl?.label);
  const terms = TERM_FIELDS.map((k) => f.get(k)).filter((x): x is FounderField => !!x && !!termValue(x.key, x.value)).map((x) => termLine(x.key, x.value));
  put("terms", terms.join("\n"), terms.length ? "Questionnaire" : undefined);
  put("logo_image", f.get("logo_image")?.value, "Logo");
  return { values, sources };
}

async function projectPrefill(projectId: string): Promise<FounderPrefill | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const ep = await entrepreneurProfile(project);
  const rows = (ep.odoo?.sections ?? []).flatMap((s) => s.rows).filter((r) => r.saveKey !== null || r.label === "Assigned agent");
  const q = (label: string) => asText(rows.find((r) => r.label === label)?.value);

  const [{ data: contact }, { data: companyRow }] = await Promise.all([
    project.founder_contact_id
      ? db().from("crm_contacts").select("name, email, phone").eq("id", project.founder_contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    ep.companyId ? db().from("companies").select(COMPANY_COLS).eq("id", ep.companyId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ct = (contact ?? {}) as { name?: string | null; email?: string | null; phone?: string | null };
  const founder = (ep.founder ?? project.founder_name ?? ct.name ?? "").trim();
  const company = (ep.company ?? "").trim();

  // Questionnaire answers, in the panel's order; a linked company profile fills gaps.
  const fields: FounderField[] = [];
  const add = (key: string, label: string, value: string | null | undefined) => { const v = (value ?? "").trim(); if (v && !fields.some((x) => x.key === key)) fields.push({ key, label, value: v }); };
  add("company_name", "Company", company);
  add("founder", "Founder", [founder, ct.email, ct.phone].filter(Boolean).join(" · "));
  add("website", "Website", ep.website);
  add("body", "Business summary", q("Business summary"));
  add("considerations", "Five key highlights", q("Five key highlights"));
  const request = q("Entrepreneur's request");
  const parsed = raiseFromRequest(request);
  const range = q("Seeking amount of capital") || ep.raise || "";
  add("raise", "Raise", parsed ? `${parsed} (request)${range ? ` · range ${range}` : ""}` : range);
  add("funding_stage", "Funding stage", [q("Funding stage"), q("Operating stage") && `operating: ${q("Operating stage")}`].filter(Boolean).join(" · "));
  add("capital_type", "Capital type", q("Seeking type(s) of capital"));
  add("revenue", "Revenue / EBITDA", [q("Annual revenue size"), q("Annual EBITDA") && `EBITDA ${q("Annual EBITDA")}`].filter(Boolean).join(" · "));
  add("use_of_funds", "Use of funds", q("Use of funds"));
  add("industries", "Industries", q("Type of industries") || ep.industry);
  add("investor_types", "Investor types sought", q("Seeking type of investor(s)"));
  add("team", "Management team", q("Management team experience"));
  add("bio", "Founder bio", q("Short bio"));
  add("entity", "Business entity", q("Business entity"));
  if (companyRow) for (const cf of companyFields(companyRow as Company)) add(cf.key, cf.label, cf.value);

  const { values, sources } = valuesFrom(fields);
  // The panel labels the raise with its source; the template wants the amount.
  if (parsed) values.terms = (values.terms ?? "").replace(/^Raise: .*$/m, `Raise: ${parsed}`);
  if (companyRow && (companyRow as Company).business_description) sources.body = "Company description";
  else if (values.body) sources.body = "Business summary";
  const banner = await lastBanner(company);
  if (banner) { values.hero_image = banner.url; sources.hero_image = banner.from; add("hero_image", "Banner", `${banner.url.split("/").pop()} · from ${banner.from}`); }

  const synced = ptDay(ep.syncedAt);
  return {
    ref: { kind: "project", id: projectId },
    label: [founder, company].filter(Boolean).join(" · "),
    source: ep.odoo?.hasQuestionnaire ? `Odoo questionnaire${synced ? `, synced ${synced}` : ""}` : companyRow ? "iCapOS company profile" : "Investor Relations project",
    recordUrl: `/admin/ir/projects/${projectId}`,
    values, sources, website: ep.website ?? null, fields,
  };
}

async function companyPrefill(companyId: string): Promise<FounderPrefill | null> {
  const { data } = await db().from("companies").select(COMPANY_COLS).eq("id", companyId).maybeSingle();
  const c = data as Company | null;
  if (!c) return null;
  const { data: prof } = c.founder_id
    ? await db().from("profiles").select("full_name, email").eq("id", c.founder_id).maybeSingle()
    : { data: null };
  const p = (prof ?? {}) as { full_name?: string | null; email?: string | null };
  const fields = companyFields(c);
  const founder = (p.full_name ?? "").trim();
  if (founder || p.email || c.contact_phone) fields.splice(1, 0, { key: "founder", label: "Founder", value: [founder, p.email, c.contact_phone].filter(Boolean).join(" · ") });
  const { values, sources } = valuesFrom(fields);
  const company = String(c.company_name ?? "").trim();
  const banner = await lastBanner(company);
  if (banner) { values.hero_image = banner.url; sources.hero_image = banner.from; fields.push({ key: "hero_image", label: "Banner", value: `${banner.url.split("/").pop()} · from ${banner.from}` }); }
  return {
    ref: { kind: "company", id: companyId },
    label: [founder, company].filter(Boolean).join(" · ") || company,
    source: "iCapOS company profile",
    recordUrl: `/admin/companies/${companyId}`,
    values, sources, website: (c.website as string | null) ?? null, fields,
  };
}

export async function founderPrefill(ref: FounderRef | string): Promise<FounderPrefill | null> {
  const r: FounderRef = typeof ref === "string" ? { kind: "project", id: ref } : ref;
  return r.kind === "company" ? companyPrefill(r.id) : projectPrefill(r.id);
}

/** "project:<id>" / "company:<id>" ↔ FounderRef, as stored on a template. */
export function parseFounderRef(s: string | null | undefined): FounderRef | null {
  const m = (s ?? "").match(/^(project|company):([0-9a-f-]{36})$/i);
  return m ? { kind: m[1].toLowerCase() as FounderRef["kind"], id: m[2] } : null;
}

/** Founder search for the picker: Investor Relations projects and iCapOS founder accounts. */
export async function searchFounders(q: string): Promise<FounderOption[]> {
  const term = q.trim().replace(/[%_,()]/g, " ").trim();
  const like = `%${term}%`;
  const projQ = db().from("ir_projects").select("id, title, founder_name").order("title", { ascending: true }).limit(8);
  const compQ = db().from("companies").select("id, company_name, founder_id").or("is_sample.is.null,is_sample.eq.false").order("company_name", { ascending: true }).limit(8);
  const [{ data: projects }, { data: companies }] = await Promise.all([
    term ? projQ.or(`title.ilike.${like},founder_name.ilike.${like}`) : projQ,
    term ? compQ.ilike("company_name", like) : compQ,
  ]);
  const comps = (companies ?? []) as Array<{ id: string; company_name: string; founder_id: string | null }>;
  const ids = comps.map((c) => c.founder_id).filter(Boolean) as string[];
  const { data: profs } = ids.length ? await db().from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name ?? ""]));
  return [
    ...((projects ?? []) as Array<{ id: string; title: string; founder_name: string | null }>).map((p) => ({
      ref: { kind: "project" as const, id: p.id },
      label: [p.founder_name, p.title !== p.founder_name ? p.title : null].filter(Boolean).join(" · ") || p.title,
      sub: "Investor Relations project",
    })),
    ...comps.map((c) => ({
      ref: { kind: "company" as const, id: c.id },
      label: [c.company_name, c.founder_id ? name.get(c.founder_id) : null].filter(Boolean).join(" · "),
      sub: "iCapOS founder account",
    })),
  ];
}
