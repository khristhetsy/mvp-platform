import { z } from "zod";

// Shared client/server schema for the non-binding express-interest form.
// At most: name, email, optional intended amount (free text, never parsed).
export const expressInterestSchema = z.object({
  listingId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(254),
  intendedAmount: z.string().trim().max(40).optional().or(z.literal("")),
  // Honeypot: humans never see it. Accept any value here so a filled field does
  // NOT fail validation — the server action detects it and returns silent success
  // (pretend-success, write nothing) rather than a distinguishable error.
  website: z.string().max(255).optional().or(z.literal("")),
});

export type ExpressInterestInput = z.infer<typeof expressInterestSchema>;
