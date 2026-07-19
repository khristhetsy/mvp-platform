import { z } from "zod";

export const OFFERING_TYPES = ["reg_cf", "reg_d_506b", "reg_d_506c", "not_raising"] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

export const offeringTypeSchema = z.object({
  offeringType: z.enum(OFFERING_TYPES),
  // Attestation must be explicitly true. Kept as a refined boolean for zod-version
  // portability (equivalent to z.literal(true)).
  attested: z.boolean().refine((v) => v === true, {
    message: "Attestation is required to continue.",
  }),
});

export type OfferingTypeInput = z.infer<typeof offeringTypeSchema>;
