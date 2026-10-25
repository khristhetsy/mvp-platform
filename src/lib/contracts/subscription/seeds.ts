// The subscription package masters installed with the app, with their field maps.
// Built from the BLANK executable package by scripts/subscription-masters/build.py;
// seeds.test.ts checks every map against its file. Fields use the same tokens as
// the term sheets where they mean the same thing (company_name, spv_name, date), so
// the cover email and the prefill work unchanged.

import type { FieldMatch, FieldType, SignatureAnchors } from "../types";
import { MASTER_BASE64 as COVER_INDEX } from "../masters/sub-cover-index";
import { MASTER_BASE64 as INSTRUCTIONS } from "../masters/sub-instructions";
import { MASTER_BASE64 as SIG_SUBSCRIPTION_ENTITY } from "../masters/sub-sig-subscription-entity";
import { MASTER_BASE64 as SIG_SUBSCRIPTION_INDIVIDUAL } from "../masters/sub-sig-subscription-individual";
import { MASTER_BASE64 as SIG_SPOUSE } from "../masters/sub-sig-spouse";
import { MASTER_BASE64 as SIG_LLC_ENTITY } from "../masters/sub-sig-llc-entity";
import { MASTER_BASE64 as SIG_LLC_INDIVIDUAL } from "../masters/sub-sig-llc-individual";
import { MASTER_BASE64 as FORM_AI_ENTITY } from "../masters/sub-form-ai-entity";
import { MASTER_BASE64 as FORM_AI_INDIVIDUAL } from "../masters/sub-form-ai-individual";
import { MASTER_BASE64 as PPM } from "../masters/sub-ppm";
import { MASTER_BASE64 as AGREEMENT } from "../masters/sub-agreement";
import type { PartKey } from "./package";

export type SubscriptionSeedField = { token: string; label: string; type: FieldType; required: boolean; default_value: string | null; position_ref: FieldMatch[] };
export type SubscriptionSeed = {
  key: string;
  name: string;
  part: PartKey;
  filename: string;
  base64: string;
  /** "sign": the subscriber signs it on a signing link. "review": sent to read. */
  delivery: "sign" | "review";
  anchors: SignatureAnchors;
  fields: SubscriptionSeedField[];
};

const f = (token: string, label: string, type: FieldType, finds: (string | FieldMatch)[], required = true, default_value: string | null = null): SubscriptionSeedField => ({
  token,
  label,
  type,
  required,
  default_value,
  position_ref: finds.map((x) => (typeof x === "string" ? { find: x } : x)),
});

const SPV = f("spv_name", "SPV name", "text", ["(SPV LLC COMPANY)"]);
/** The cover and the instructions also write the SPV as "(SPV COMPANY)". */
const SPV_BOTH = f("spv_name", "SPV name", "text", ["(SPV LLC COMPANY)", "(SPV COMPANY)"]);
const ISSUER = f("company_name", "Company legal name", "text", ["(ISSUER COMPANY)"]);
const DATE = f("date", "Date", "date", ["(DATE)"]);
const SUBSCRIBER = f("subscriber_name", "Subscriber name", "text", ["(SUBSCRIBER NAME)"]);
const AMOUNT = f("subscription_amount", "Subscription amount", "currency", ["(AMOUNT)"]);
const INTERESTS = f("interests_count", "Number of Interests", "derived", ["(INTERESTS)"]);

/** Review documents have no signature to place. */
const NO_SIGNATURE: SignatureAnchors = { prospect: { party: "" }, countersign: [] };
const FUND_COUNTERSIGN = [{ party: "FUND:" }];

const sigSubscription = (individual: boolean): Pick<SubscriptionSeed, "fields" | "anchors"> => ({
  anchors: { prospect: { party: individual ? "SUBSCRIBER (Individual / Joint Individuals)" : "SUBSCRIBER (Entity)" }, countersign: FUND_COUNTERSIGN },
  fields: [
    SPV,
    SUBSCRIBER,
    AMOUNT,
    INTERESTS,
    f("mailing_address", "Mailing address", "multiline", ["(MAILING ADDRESS)"]),
    f("telephone", "Telephone", "text", ["(TELEPHONE)"]),
    f("subscriber_email", "Subscriber email", "text", ["(EMAIL)"]),
  ],
});

export const SUBSCRIPTION_SEEDS: SubscriptionSeed[] = [
  {
    key: "sub_cover_index",
    name: "Subscription Package, Cover and Index",
    part: "cover_index",
    filename: "Subscription Package - Cover and Index.docx",
    base64: COVER_INDEX,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [SPV_BOTH, ISSUER, DATE],
  },
  {
    key: "sub_instructions",
    name: "Subscription Instructions",
    part: "instructions",
    filename: "Subscription Package - Subscription Instructions.docx",
    base64: INSTRUCTIONS,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [
      SPV_BOTH,
      ISSUER,
      f("bank", "Bank", "text", ["(BANK)"]),
      // The three (00000) blanks are claimed in document order: routing, account, reference.
      f("ach_routing", "ACH routing number", "text", [{ find: "(00000)", nth: 0 }]),
      f("account_number", "Account number", "text", [{ find: "(00000)", nth: 0 }]),
      f("reference_code", "Reference code", "text", [{ find: "(00000)", nth: 0 }]),
      f("fund_ein", "Fund EIN", "text", ["99-5021106"]),
    ],
  },
  {
    key: "sub_sig_subscription_entity",
    name: "Signature Page, Subscription Agreement (entity)",
    part: "signature_pages",
    filename: "Subscription Package - Signature Page, Subscription Agreement (entity).docx",
    base64: SIG_SUBSCRIPTION_ENTITY,
    delivery: "sign",
    ...sigSubscription(false),
  },
  {
    key: "sub_sig_subscription_individual",
    name: "Signature Page, Subscription Agreement (individual)",
    part: "signature_pages",
    filename: "Subscription Package - Signature Page, Subscription Agreement (individual).docx",
    base64: SIG_SUBSCRIPTION_INDIVIDUAL,
    delivery: "sign",
    ...sigSubscription(true),
  },
  {
    key: "sub_sig_spouse",
    name: "Agreement of Spouse",
    part: "signature_pages",
    filename: "Subscription Package - Agreement of Spouse.docx",
    base64: SIG_SPOUSE,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [SPV, SUBSCRIBER],
  },
  {
    key: "sub_sig_llc_entity",
    name: "Signature Page, LLC Agreement (entity)",
    part: "signature_pages",
    filename: "Subscription Package - Signature Page, LLC Agreement (entity).docx",
    base64: SIG_LLC_ENTITY,
    delivery: "sign",
    anchors: { prospect: { party: "MEMBER (Entity)" }, countersign: [] },
    fields: [SUBSCRIBER],
  },
  {
    key: "sub_sig_llc_individual",
    name: "Signature Page, LLC Agreement (individual)",
    part: "signature_pages",
    filename: "Subscription Package - Signature Page, LLC Agreement (individual).docx",
    base64: SIG_LLC_INDIVIDUAL,
    delivery: "sign",
    // The heading is flush left while the signature line is indented; "Individuals)" sits in the same column as By:.
    anchors: { prospect: { party: "Individuals)" }, countersign: [] },
    fields: [SUBSCRIBER],
  },
  {
    key: "sub_form_ai_entity",
    name: "Accredited Investor Verification Letter (entities)",
    part: "forms",
    filename: "Subscription Package - Accredited Investor Letter (entities).docx",
    base64: FORM_AI_ENTITY,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [],
  },
  {
    key: "sub_form_ai_individual",
    name: "Accredited Investor Verification Letter (individuals)",
    part: "forms",
    filename: "Subscription Package - Accredited Investor Letter (individuals).docx",
    base64: FORM_AI_INDIVIDUAL,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [],
  },
  {
    key: "sub_ppm",
    name: "Private Placement Memorandum",
    part: "ppm",
    filename: "Subscription Package - Private Placement Memorandum.docx",
    base64: PPM,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [
      SPV,
      ISSUER,
      DATE,
      f("issuer_name", "Issuer chief executive name", "text", ["(ISSUER NAME)"]),
      f("issuer_contact", "Issuer contact", "text", ["(ISSUER CONTACT)"]),
      f("issuer_address", "Issuer address", "multiline", ["(ISSUER ADDRESS)"]),
      // Terms of the portfolio company's convertible notes, as the Memorandum states them (same tokens as the term sheet).
      f("interest_rate", "Interest rate", "percent", [{ find: "(10%)", replace: "10" }], true, "10.0"),
      f("warrant_coverage", "Warrant coverage", "percent", [{ find: "(30%)", replace: "30" }], true, "30"),
      f("conversion_discount", "Conversion discount", "percent", [{ find: "(20%)", replace: "20" }], true, "20"),
      f("valuation_cap", "Valuation cap", "currency", [{ find: "($30,000,000)", replace: "30,000,000" }, { find: "$30,000,000.", replace: "30,000,000" }]),
      f("qualified_financing", "Qualified financing minimum", "currency", [{ find: "minimum size of $5,000,000", replace: "5,000,000" }], true, "5,000,000"),
      // The offering table. The three typed figures are the master's own; the rest of the table is calculated from them.
      f("offering_price", "Price per Interest", "currency", ["(OFFERING PRICE)"], true, "50,000"),
      f("offering_max", "Maximum offering", "currency", ["(OFFERING MAX)", { find: "maximum offering amount of $5,000,000", replace: "5,000,000" }], true, "5,000,000"),
      f("offering_expenses", "Estimated offering expenses", "currency", ["(OFFERING EXPENSES)"], true, "35,100"),
      f("offering_interests", "Number of Interests offered", "derived", [{ find: "subscription for 100 Interests in the maximum", replace: "100" }]),
      f("expense_per_interest", "Expenses per Interest", "derived", ["(EXPENSE PER INTEREST)"]),
      f("proceeds_per_interest", "Proceeds per Interest", "derived", ["(PROCEEDS PER INTEREST)"]),
      f("offering_proceeds", "Aggregate proceeds", "derived", ["(OFFERING PROCEEDS)"]),
    ],
  },
  {
    key: "sub_agreement",
    name: "Subscription Agreement",
    part: "agreement",
    filename: "Subscription Package - Subscription Agreement.docx",
    base64: AGREEMENT,
    delivery: "review",
    anchors: NO_SIGNATURE,
    fields: [SPV, ISSUER, DATE],
  },
];
