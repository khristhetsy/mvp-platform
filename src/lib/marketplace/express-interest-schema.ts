import { z } from "zod";

// Shared client/server schema for the non-binding express-interest form.
// At most: name, email, optional intended amount (free text, never parsed).
export const expressInterestSchema = z.object({
  listingId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email.").max(254),
  intendedAmount: z.string().trim().max(40).optional().or(z.literal("")),
  // Honeypot: must be empty. Bots fill it; humans never see it.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ExpressInterestInput = z.infer<typeof expressInterestSchema>;
