// SEC Form D connector — domain types (build spec §3). Mirrors the columns of
// formd_filings / formd_related_persons. Pure data; no I/O.

export type FormDRelatedPerson = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  relationships: string | null; // "Executive Officer; Director"
  city: string | null;
  state: string | null;
  isSigner: boolean;
  // Street address is intentionally NOT captured (spec §3.2 / §13.7).
};

export type FormDFiling = {
  accessionNo: string;
  cik: string;
  formType: string; // 'D' | 'D/A'
  isAmendment: boolean;
  dateFiled: string | null; // YYYY-MM-DD

  companyName: string;
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  yearOfInc: string | null;

  industry: string | null;
  isFund: boolean;
  revenueRange: string | null;
  exemptions: string | null;
  is506c: boolean;

  totalOffering: number | null; // null when "Indefinite"
  totalSold: number | null;
  totalRemaining: number | null;
  pctSold: number | null;
  minInvestment: number | null;
  investorCount: number | null;

  dateFirstSale: string | null;
  saleYetToOccur: boolean;
  daysSinceFirstSale: number | null;

  hasPlacementAgent: boolean;
  placementAgents: string | null;
  salesCommission: number | null;

  signerName: string | null;
  signerTitle: string | null;

  relatedPersons: FormDRelatedPerson[];

  filingUrl: string | null;
};
