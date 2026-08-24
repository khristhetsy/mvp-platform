// Shared event-registration field config — used by both the public registration
// form and the admin "Register a guest" form so the two never drift.

import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";

export type RegistrationField = {
  key: string;
  label: string;
  kind: "text" | "select" | "chips" | "textarea" | "checkbox";
  options?: string[];
  required?: boolean;
};

const SECTORS = EVENT_SECTORS.map((s) => s.label);

export const REGISTRATION_COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "India", "Singapore", "Other"];

export const REGISTRATION_ROLES: { key: AttendeeType; label: string }[] = [
  { key: "investor", label: "Investor" },
  { key: "founder", label: "Founder" },
  { key: "service", label: "Service Provider" },
  { key: "sponsor", label: "Sponsor" },
];

export const REGISTRATION_COMMON: RegistrationField[] = [
  { key: "name", label: "Full name", kind: "text", required: true },
  { key: "company", label: "Company / firm", kind: "text", required: true },
  { key: "title", label: "Title", kind: "text", required: true },
  { key: "country", label: "Country", kind: "select", options: REGISTRATION_COUNTRIES, required: true },
  { key: "email", label: "Email", kind: "text", required: true },
  { key: "phone", label: "Phone number", kind: "text", required: true },
];

// Every question is required. Checkboxes stay optional (a single yes/no opt-in
// can't be sensibly "required"). "Open to founder intros?" is gone — every
// registrant is open to intros by default.
export const REGISTRATION_BY_TYPE: Record<AttendeeType, RegistrationField[]> = {
  investor: [
    { key: "investorType", label: "Investor type", kind: "select", options: ["Angel", "Venture Capital", "Private Equity", "Family Office", "LP", "Syndicate"], required: true },
    { key: "checkSize", label: "Typical check size", kind: "select", options: ["< $25k", "$25k–$100k", "$100k–$500k", "$500k–$2M", "$2M+"], required: true },
    { key: "stages", label: "Stage focus", kind: "chips", options: ["Pre-seed", "Seed", "Series A", "Series B+"], required: true },
    { key: "sectors", label: "Sectors of interest", kind: "chips", options: SECTORS, required: true },
    { key: "thesis", label: "Investment thesis / what you look for", kind: "textarea", required: true },
    { key: "accredited", label: "I am an accredited investor", kind: "checkbox" },
  ],
  founder: [
    { key: "stage", label: "Company stage", kind: "select", options: ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"], required: true },
    { key: "sector", label: "Sector", kind: "select", options: SECTORS, required: true },
    { key: "raising", label: "Currently raising?", kind: "select", options: ["Not raising", "Raising now", "In 3–6 months"], required: true },
    { key: "roundSize", label: "Round size", kind: "select", options: ["< $250k", "$250k–$1M", "$1M–$3M", "$3M+"], required: true },
    { key: "lookingFor", label: "Looking for", kind: "chips", options: ["Capital", "Investor intros", "Mentorship", "Partners", "Hiring"], required: true },
    { key: "pitch", label: "One-line pitch", kind: "textarea", required: true },
    { key: "applyToPresent", label: "Apply to present at the showcase", kind: "checkbox" },
  ],
  service: [
    { key: "serviceCategory", label: "Service category", kind: "select", options: ["Legal", "Banking", "Accounting", "Consulting", "Marketing", "Tech / Tools"], required: true },
    { key: "whoYouServe", label: "Who you serve", kind: "select", options: ["Founders", "Investors", "Both"], required: true },
    { key: "specialty", label: "Specialty / offer", kind: "textarea", required: true },
    { key: "interestedIn", label: "Interested in", kind: "chips", options: ["Just attending", "A booth", "Sponsorship", "Speaking"], required: true },
  ],
  sponsor: [
    { key: "tier", label: "Tier interest", kind: "select", options: ["Presenting", "Gold", "Silver", "Community", "Not sure"], required: true },
    { key: "budget", label: "Budget range", kind: "select", options: ["< $5k", "$5k–$15k", "$15k–$40k", "$40k+"], required: true },
    { key: "goals", label: "Goals", kind: "chips", options: ["Lead generation", "Brand awareness", "Recruiting", "Thought leadership"], required: true },
    { key: "timeline", label: "Decision timeline", kind: "select", options: ["This week", "This month", "Exploring"], required: true },
    { key: "notes", label: "Anything we should know?", kind: "textarea", required: true },
  ],
};
