// SEC Form D XML parser (build spec §4.5). The one defect that matters: EDGAR is
// inconsistent about whether `edgarSubmission` carries a default namespace, and a
// namespace-aware path expression silently returns empty strings for every field.
// So we STRIP namespaces from every tag first, then read by local name.
//
// No XML dependency — a small, well-tested tag reader is enough for Form D's flat
// structure, and keeps the parse deterministic and dependency-free.

import { normalizeName } from "./dedupe";
import type { FormDFiling, FormDRelatedPerson } from "./types";

/** Remove the XML declaration, all xmlns attributes, and element namespace prefixes. */
export function stripNamespaces(xml: string): string {
  return xml
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/\sxmlns(:[A-Za-z0-9_]+)?="[^"]*"/g, "")
    .replace(/<(\/?)[A-Za-z0-9_]+:/g, "<$1");
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Inner XML of the first <tag>…</tag>, or null. */
function block(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}
/** Inner XML of every <tag>…</tag>. */
function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
/** Trimmed text of the first <tag>, or null (blank → null). */
function text(xml: string, tag: string): string | null {
  const b = block(xml, tag);
  if (b == null) return null;
  const t = decode(b).replace(/<[^>]*>/g, "").trim();
  return t || null;
}
/** True when <tag>true</tag> (self-closing <tag/> also counts as false unless "true"). */
function bool(xml: string, tag: string): boolean {
  return (text(xml, tag) ?? "").toLowerCase() === "true";
}
/** A dollar/number field — commas and $ stripped; "Indefinite"/blank → null. */
function money(xml: string, tag: string): number | null {
  const t = text(xml, tag);
  if (!t || /indefinite/i.test(t)) return null;
  const n = Number(t.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function intVal(xml: string, tag: string): number | null {
  const t = text(xml, tag);
  if (!t) return null;
  const n = parseInt(t.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export type ParseContext = {
  accessionNo: string;
  dateFiled?: string | null;
  filingUrl?: string | null;
  cik?: string | null;
  formType?: string | null;
};

/** Parse a Form D primary_doc.xml into a FormDFiling (+ related persons). */
export function parseFormD(rawXml: string, ctx: ParseContext): FormDFiling {
  const xml = stripNamespaces(rawXml);
  const issuer = block(xml, "primaryIssuer") ?? "";
  const addr = block(issuer, "issuerAddress") ?? "";
  const offering = block(xml, "offeringData") ?? "";

  // ── related persons (street address intentionally dropped) ──
  const relatedBlock = block(xml, "relatedPersonsList") ?? "";
  const relatedPersons: FormDRelatedPerson[] = blocks(relatedBlock, "relatedPersonInfo").map((r) => {
    const nameB = block(r, "relatedPersonName") ?? r;
    const first = text(nameB, "firstName");
    const middle = text(nameB, "middleName");
    const last = text(nameB, "lastName");
    const full = [first, middle, last].filter(Boolean).join(" ").trim();
    const relList = block(r, "relatedPersonRelationshipList") ?? "";
    const relationships = blocks(relList, "relationship").map((x) => decode(x).replace(/<[^>]*>/g, "").trim()).filter(Boolean).join("; ") || null;
    const raddr = block(r, "relatedPersonAddress") ?? "";
    return {
      firstName: first, middleName: middle, lastName: last,
      fullName: full || "Unknown",
      relationships,
      city: text(raddr, "city"),
      state: text(raddr, "stateOrCountry") ?? text(raddr, "state"),
      isSigner: false,
    };
  });

  // ── exemptions / 506(c) / fund ──
  const exemptItems = blocks(block(offering, "federalExemptionsExclusions") ?? "", "item")
    .map((x) => decode(x).replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const is506c = exemptItems.some((i) => /06c/i.test(i));
  const exemptions = exemptItems.join(", ") || null;

  const industry = text(block(offering, "industryGroup") ?? "", "industryGroupType");
  const isFund = Boolean(block(offering, "investmentFundInfo")) || /fund/i.test(industry ?? "");

  // ── revenue: revenueRange, else NAV-prefixed aggregateNetAssetValueRange ──
  const sizeB = block(offering, "issuerSize") ?? offering;
  let revenueRange = text(sizeB, "revenueRange");
  if (!revenueRange) {
    const nav = text(sizeB, "aggregateNetAssetValueRange");
    revenueRange = nav ? `NAV: ${nav}` : null;
  }

  // ── amounts (Indefinite → null) ──
  const amounts = block(offering, "offeringSalesAmounts") ?? offering;
  const totalOffering = money(amounts, "totalOfferingAmount");
  const totalSold = money(amounts, "totalAmountSold");
  let totalRemaining = money(amounts, "totalRemaining") ?? money(amounts, "totalRemainingAmount");
  if (totalRemaining == null && totalOffering != null && totalSold != null) totalRemaining = totalOffering - totalSold;
  const pctSold = totalOffering && totalOffering > 0 && totalSold != null ? Math.round((totalSold / totalOffering) * 1000) / 10 : null;
  const minInvestment = money(offering, "minimumInvestmentAccepted");
  const investorCount = intVal(block(offering, "investorsList") ?? offering, "totalNumberAlreadyInvested");

  // ── first sale ──
  const firstSaleB = block(offering, "dateOfFirstSale") ?? "";
  const saleYetToOccur = bool(firstSaleB, "yetToOccur");
  const dateFirstSale = saleYetToOccur ? null : text(firstSaleB, "value");

  // ── placement agents ("None" recipients dropped so the flag stays truthful) ──
  const recipients = blocks(block(offering, "salesCompensationList") ?? "", "recipient");
  const agents = recipients
    .map((r) => text(r, "recipientName"))
    .filter((n): n is string => typeof n === "string" && n.toLowerCase() !== "none");
  const hasPlacementAgent = agents.length > 0;
  const placementAgents = hasPlacementAgent ? agents.join("; ") : null;
  const salesCommission = money(block(offering, "salesCommissions") ?? offering, "dollarAmount");

  // ── signer + match to roster by normalized name ──
  const sigB = block(offering, "signatureBlock") ?? block(xml, "signatureBlock") ?? "";
  const firstSig = block(sigB, "signature") ?? sigB;
  const signerName = text(firstSig, "nameOfSigner") ?? text(firstSig, "signatureName");
  const signerTitle = text(firstSig, "signatureTitle");
  if (signerName) {
    const norm = normalizeName(signerName);
    for (const p of relatedPersons) if (normalizeName(p.fullName) === norm) p.isSigner = true;
  }

  const formType = ctx.formType ?? text(xml, "submissionType") ?? "D";
  const isAmendment = formType === "D/A" || bool(block(offering, "typeOfFiling") ?? "", "isAmendment");

  return {
    accessionNo: ctx.accessionNo,
    cik: (ctx.cik ?? text(issuer, "cik") ?? "").replace(/^0+/, "") || (ctx.cik ?? ""),
    formType,
    isAmendment,
    dateFiled: ctx.dateFiled ?? null,

    companyName: text(issuer, "entityName") ?? "",
    phone: text(issuer, "issuerPhoneNumber"),
    street1: text(addr, "street1"),
    street2: text(addr, "street2"),
    city: text(addr, "city"),
    state: text(addr, "stateOrCountry") ?? text(addr, "state"),
    zipCode: text(addr, "zipCode"),
    entityType: text(issuer, "entityType"),
    jurisdiction: text(issuer, "jurisdictionOfInc"),
    yearOfInc: text(block(issuer, "yearOfInc") ?? "", "value"),

    industry,
    isFund,
    revenueRange,
    exemptions,
    is506c,

    totalOffering,
    totalSold,
    totalRemaining,
    pctSold,
    minInvestment,
    investorCount,

    dateFirstSale,
    saleYetToOccur,
    daysSinceFirstSale: null, // set by ingest / recomputed nightly

    hasPlacementAgent,
    placementAgents,
    salesCommission,

    signerName,
    signerTitle,

    relatedPersons,

    filingUrl: ctx.filingUrl ?? null,
  };
}

/** Whole days between first sale and `asOf` (recomputed nightly per spec §4.7). */
export function daysSinceFirstSale(dateFirstSale: string | null, asOf: Date = new Date()): number | null {
  if (!dateFirstSale) return null;
  const d = new Date(dateFirstSale + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((asOf.getTime() - d.getTime()) / 86_400_000));
}
