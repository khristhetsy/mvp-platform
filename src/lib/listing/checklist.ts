/**
 * Private Market listing checklist (approved Oct 9, 2026).
 *
 * A founder is listed for the iCFO investor network once all four checks pass.
 * There is no pass or fail on the score: any Capital Readiness Rating
 * qualifies, and investors decide for themselves which listings to open.
 *
 *  1. Documents uploaded: pitch deck, financial statements and cap table (the
 *     canonical Qualify documents). A type marked N/A counts as done, the same
 *     rule as everywhere else in iCapOS.
 *  2. Due diligence report complete: a saved AI diligence report with an
 *     executive summary.
 *  3. Figures attested: the founder confirmed the revenue and cap table figures
 *     (AI drafts the craft, the founder owns the facts).
 *  4. Opted in to the investor listing.
 *
 * Pure evaluation lives here so the dashboard card, the APIs and the tests all
 * read one rule.
 */
import { QUALIFY_REQUIRED_DOCUMENTS, isQualifyDocSatisfied } from "@/lib/founder-journey/documents";

export type ListingItemKey = "documents" | "report" | "attested" | "opt_in";

export type ListingItem = {
  key: ListingItemKey;
  label: string;
  done: boolean;
  /** One short line under the label (what is missing, or when it was done). */
  detail: string | null;
};

export type ListingChecklist = {
  items: ListingItem[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** Labels of the required documents still missing. */
  missingDocuments: string[];
};

export type ListingInputs = {
  uploadedTypes: ReadonlyArray<string | null | undefined>;
  notApplicableTypes: ReadonlyArray<string>;
  report: { executive_summary: string | null } | null;
  figuresAttestedAt: string | null;
  listingOptInAt: string | null;
};

export function evaluateListingChecklist(input: ListingInputs): ListingChecklist {
  const present = [...input.uploadedTypes, ...input.notApplicableTypes];
  const missingDocuments = QUALIFY_REQUIRED_DOCUMENTS.filter((d) => !isQualifyDocSatisfied(present, d)).map((d) => d.label);
  const docsDone = missingDocuments.length === 0;
  const reportDone = Boolean(input.report?.executive_summary && input.report.executive_summary.trim());
  const attested = Boolean(input.figuresAttestedAt);
  const optedIn = Boolean(input.listingOptInAt);

  const items: ListingItem[] = [
    {
      key: "documents",
      label: "Documents uploaded",
      done: docsDone,
      detail: docsDone ? "Pitch deck, financial statements and cap table" : `Still needed: ${missingDocuments.join(", ")}`,
    },
    {
      key: "report",
      label: "Due diligence report complete",
      done: reportDone,
      detail: reportDone ? null : docsDone ? "Generate your free AI due diligence report" : "Generated once your documents are in",
    },
    {
      key: "attested",
      label: "Confirm revenue and cap table figures",
      done: attested,
      detail: attested ? null : "You confirm the numbers investors will read are accurate",
    },
    {
      key: "opt_in",
      label: "Opt in to investor listing",
      done: optedIn,
      detail: optedIn ? null : "Your listing summary is shown to matched investors. Documents stay private",
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, total: items.length, complete: doneCount === items.length, missingDocuments };
}
