// Subscription package: which documents go to which subscriber. Pure (unit tested
// in package.test.ts). The package has six parts; the subscriber profile decides
// which documents each part holds, following the Subscription Instructions:
//   - U.S. persons complete IRS Form W-9; non-U.S. individuals W-8BEN; other
//     non-U.S. persons W-8BEN-E.
//   - Accredited entities present the entity verification letter, accredited
//     individuals the individual one.
//   - A spouse signs the Agreement of Spouse only for subscribers who reside in
//     the community property states the Instructions list.

export const SUBSCRIPTION_PACKAGE_KEY = "subscription";

export type PartKey = "cover_index" | "instructions" | "signature_pages" | "forms" | "ppm" | "agreement";

export const PARTS: { key: PartKey; no: number; label: string; blurb: string }[] = [
  { key: "cover_index", no: 1, label: "Cover and Index", blurb: "Dated cover page and the index of the package." },
  { key: "instructions", no: 2, label: "Subscription Instructions", blurb: "How to subscribe and fund, after the Manager accepts." },
  { key: "signature_pages", no: 3, label: "Signature Pages", blurb: "Subscription Agreement, LLC Agreement and, where required, the Agreement of Spouse." },
  { key: "forms", no: 4, label: "Forms", blurb: "IRS Forms W-9, W-8BEN-E and W-8BEN, and the Accredited Investor Verification Letter. The one that applies to the subscriber is marked." },
  { key: "ppm", no: 5, label: "Private Placement Memorandum", blurb: "The Memorandum with Exhibits A to E." },
  { key: "agreement", no: 6, label: "Subscription Agreement", blurb: "The Agreement with Attachments A to F." },
];

export const PART_LABEL: Record<PartKey, string> = Object.fromEntries(PARTS.map((p) => [p.key, p.label])) as Record<PartKey, string>;

/** States whose spouses sign the Agreement of Spouse (from the Subscription Instructions, footnote 1). */
export const COMMUNITY_PROPERTY_STATES = ["Alaska", "Arizona", "California", "Idaho", "Louisiana", "Nevada", "New Mexico", "Texas", "Washington", "Wisconsin"] as const;

/** "joint": two individuals who sign together on one link. */
export type SubscriberType = "entity" | "individual" | "joint";
export type SubscriberProfile = { type: SubscriberType; usPerson: boolean; spouseSigns: boolean };

export const DEFAULT_PROFILE: SubscriberProfile = { type: "entity", usPerson: true, spouseSigns: false };

/** The IRS forms the package carries as PDFs (no fields). */
export type FormKey = "w9" | "w8bene";
export const FORM_TITLE: Record<FormKey | "w8ben", string> = {
  w9: "IRS Form W-9",
  w8bene: "IRS Form W-8BEN-E",
  w8ben: "IRS Form W-8BEN",
};

export type PackageItem =
  | { source: "template"; part: PartKey; templateKey: string }
  | { source: "pdf"; part: "forms"; formKey: FormKey; title: string; applies: boolean }
  /** A form the package should carry but the source file does not include. */
  | { source: "missing"; part: "forms"; title: string; note: string; applies: boolean };

/**
 * Documents for a subscriber, in package order. The Forms part always lists the three
 * IRS forms; `applies` marks the one the Subscription Instructions require of this subscriber.
 */
export function packageItems(p: SubscriberProfile): PackageItem[] {
  const individual = p.type !== "entity";
  const joint = p.type === "joint";
  const items: PackageItem[] = [];
  items.push({ source: "template", part: "cover_index", templateKey: "sub_cover_index" });
  items.push({ source: "template", part: "instructions", templateKey: "sub_instructions" });
  items.push({ source: "template", part: "signature_pages", templateKey: joint ? "sub_sig_subscription_joint" : individual ? "sub_sig_subscription_individual" : "sub_sig_subscription_entity" });
  if (p.spouseSigns && p.type === "individual") items.push({ source: "template", part: "signature_pages", templateKey: "sub_sig_spouse" });
  items.push({ source: "template", part: "signature_pages", templateKey: joint ? "sub_sig_llc_joint" : individual ? "sub_sig_llc_individual" : "sub_sig_llc_entity" });
  items.push({ source: "pdf", part: "forms", formKey: "w9", title: FORM_TITLE.w9, applies: p.usPerson });
  items.push({ source: "pdf", part: "forms", formKey: "w8bene", title: FORM_TITLE.w8bene, applies: !p.usPerson && !individual });
  items.push({
    source: "missing",
    part: "forms",
    title: FORM_TITLE.w8ben,
    note: "The source package has no W-8BEN. Upload the official IRS PDF as a contract PDF and send it with this package.",
    applies: !p.usPerson && individual,
  });
  items.push({ source: "template", part: "forms", templateKey: individual ? "sub_form_ai_individual" : "sub_form_ai_entity" });
  items.push({ source: "template", part: "ppm", templateKey: "sub_ppm" });
  items.push({ source: "template", part: "agreement", templateKey: "sub_agreement" });
  return items;
}

/** Every template key any profile can use, in package order. */
export const SUBSCRIPTION_TEMPLATE_KEYS = [
  "sub_cover_index",
  "sub_instructions",
  "sub_sig_subscription_entity",
  "sub_sig_subscription_individual",
  "sub_sig_subscription_joint",
  "sub_sig_spouse",
  "sub_sig_llc_entity",
  "sub_sig_llc_individual",
  "sub_sig_llc_joint",
  "sub_form_ai_entity",
  "sub_form_ai_individual",
  "sub_ppm",
  "sub_agreement",
] as const;

/** Why a spouse page does or does not apply, in words for the profile card. */
export function spouseNote(p: SubscriberProfile): string {
  if (p.type === "entity") return "Not applicable to an entity subscriber.";
  if (p.type === "joint") return "Not applicable: both joint individuals sign the Signature Pages.";
  return p.spouseSigns ? "Attached: the subscriber has a spouse in a community property state." : "Not required.";
}

/**
 * Fields that carry one value across the package. The first document that holds
 * the field (in package order) is where it is typed; the others follow it.
 * The amount is also the Manager Acceptance's capital commitment.
 */
export const PACKAGE_LINKS: { token: string; kind: "text" | "currency" }[] = [
  { token: "spv_name", kind: "text" },
  { token: "company_name", kind: "text" },
  { token: "date", kind: "text" },
  { token: "subscriber_name", kind: "text" },
  { token: "subscription_amount", kind: "currency" },
];

/** A linked value in comparable form. */
export function packageLinkValue(token: string, raw: string): string {
  const kind = PACKAGE_LINKS.find((l) => l.token === token)?.kind;
  if (kind === "currency") return raw.replace(/[^\d.]/g, "");
  return raw.trim();
}

/**
 * Values a document in the package takes from earlier documents. `earlier` is
 * the fields and stored values of the documents before it, in package order.
 */
export function packageLinkedValues(
  targetTokens: string[],
  earlier: { tokens: string[]; values: Record<string, string>; label: string }[],
): { token: string; value: string; source: string }[] {
  const out: { token: string; value: string; source: string }[] = [];
  for (const link of PACKAGE_LINKS) {
    if (!targetTokens.includes(link.token)) continue;
    for (const doc of earlier) {
      if (!doc.tokens.includes(link.token)) continue;
      const v = packageLinkValue(link.token, doc.values[link.token] ?? "");
      if (v) {
        out.push({ token: link.token, value: v, source: doc.label });
        break;
      }
    }
  }
  return out;
}

/**
 * Placeholders from the blank package that mean a part still has a blank to
 * fill. A part with any of them left cannot be sent; the editor highlights them.
 */
export const PLACEHOLDER_PATTERN = /000,000\.00|\$0,000,000|\((?:SPV(?: LLC)? COMPANY|ISSUER [A-Z ]+|ISSER EMAIL|DATE|TIME|MONTH|DAY|YEAR|MATURE DATE|MONTHS AND DATE|CITY AND STATE|THREE YEAR PERIOD|INFO HERE|BANK|SUBSCRIBER NAME|AMOUNT|INTERESTS|MAILING ADDRESS|TELEPHONE|EMAIL|0{4,5})\)/g;

/** Placeholders still in rendered text, each once, in order of first appearance. */
export function leftoverPlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_PATTERN) ?? [])];
}

/**
 * Shown above a part's editor. The Memorandum master is built from a finished deal, so
 * its exhibits are that deal's, not blanks.
 */
export const TEMPLATE_NOTES: Record<string, string> = {
  sub_ppm:
    "Upload the issuer's logo above for the Information Statement cover (or leave it off). Exhibit A and Exhibit E hold only their heading page in this master: write or paste the issuer's Information Statement and the Fund's Certificate of Formation in with the editor, or confirm them supplied in the next step. Exhibit B's financial statements show 000,000.00 placeholders to replace. One sentence in the Portfolio Company Securities section still gives the valuation cap as ($30) million. The Table of Contents page numbers are refreshed when the Memorandum is sent.",
  sub_instructions: "The Fund EIN in this master belongs to the previous Fund. Enter this Fund's EIN and its bank details.",
};
