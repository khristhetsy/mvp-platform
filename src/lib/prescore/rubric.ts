// Prospect Pipeline — Step 4: founder lead pre-score rubric.
//
// GUARDRAIL: this produces `lead_prescore` (0–100), an INTERNAL approach-priority
// signal derived ONLY from data we actually have on a prospect. It is never shown
// to the lead and never labelled "Capital Readiness Rating". It is not the CRR.
//
// Weights are tunable and sum to 100.

export const RUBRIC_WEIGHTS = {
  narrative: 25,
  financials: 25,
  materials: 20,
  governance: 15,
  dd: 15,
} as const;

export type Dimension = keyof typeof RUBRIC_WEIGHTS;

export interface PrescoreInput {
  company?: string | null;
  company_domain?: string | null;
  website?: string | null;
  email_status?: string | null;
  phone?: string | null;
  signals?: Record<string, unknown> | null;
}

export interface PrescoreResult {
  score: number;                      // 0..100 weighted
  dims: Record<Dimension, number>;    // each 0..100
  weakest: Dimension;                 // lowest-scoring weighted dimension → email hook
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function flag(sig: Record<string, unknown>, key: string): boolean {
  const v = sig[key];
  return v === true || v === "true" || (typeof v === "string" && v.length > 0);
}

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"]);

/**
 * Driver-based founder pre-score. Every dimension is computed from concrete,
 * present data — nothing is invented. Sparse prospects legitimately score low.
 */
export function computeFounderPrescore(input: PrescoreInput): PrescoreResult {
  const sig = (input.signals && typeof input.signals === "object" ? input.signals : {}) as Record<string, unknown>;
  const hasWebsite = Boolean(input.website || input.company_domain);
  const ownDomain = Boolean(input.company_domain);
  const emailDomain = ""; // not needed here; ownDomain already excludes free mail upstream

  const dims: Record<Dimension, number> = {
    // Can they articulate the company? (name + web presence + a stated sector)
    narrative: clamp((input.company ? 40 : 0) + (hasWebsite ? 40 : 0) + (flag(sig, "sector") ? 20 : 0)),
    // What do we know about their raise state?
    financials: clamp((flag(sig, "raising") ? 50 : 0) + (flag(sig, "stage") ? 30 : 0) + (flag(sig, "funding") ? 20 : 0)),
    // Public materials to work from.
    materials: clamp((input.website ? 60 : 0) + (ownDomain ? 40 : 0)),
    // Structure signals.
    governance: clamp((ownDomain && !FREE_MAIL.has(emailDomain) ? 60 : 0) + (flag(sig, "incorporated") ? 40 : 0)),
    // Diligence-ability of the contact record itself.
    dd: clamp((input.email_status === "valid" ? 50 : 0) + (input.phone ? 30 : 0) + (ownDomain ? 20 : 0)),
  };

  const score = clamp(
    (Object.keys(RUBRIC_WEIGHTS) as Dimension[]).reduce(
      (sum, d) => sum + (dims[d] * RUBRIC_WEIGHTS[d]) / 100,
      0,
    ),
  );

  // Weakest = lowest weighted contribution; that dimension becomes the hook.
  let weakest: Dimension = "narrative";
  let min = Infinity;
  for (const d of Object.keys(RUBRIC_WEIGHTS) as Dimension[]) {
    const contribution = (dims[d] * RUBRIC_WEIGHTS[d]) / 100;
    if (contribution < min) { min = contribution; weakest = d; }
  }

  return { score, dims, weakest };
}

/** Human phrase for a weak dimension — used to shape the founder hook. */
export const DIMENSION_HOOK: Record<Dimension, string> = {
  narrative: "sharpening the story",
  financials: "getting the numbers investor-ready",
  materials: "building out the data room",
  governance: "tightening governance",
  dd: "closing diligence gaps",
};
