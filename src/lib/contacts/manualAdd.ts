// Prospect Pipeline — manual single-contact add (Step 1). Validates, then routes
// through the same dedupe/insert/bridge path as file import so a hand-typed
// contact enters the identical pipeline.

import { importParsedRows } from "./importFile";
import { isValidEmail, type ContactSide, type ImportResult } from "./types";

export interface ManualAddInput {
  email: string;
  name?: string | null;
  side?: ContactSide | null;
  company?: string | null;
  website?: string | null;
  note?: string | null;
}

export async function manualAddContact(input: ManualAddInput): Promise<ImportResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error("A valid email is required.");
  }
  const side = input.side === "founder" || input.side === "investor" ? input.side : null;
  return importParsedRows(
    [
      {
        email,
        name: input.name?.trim() || null,
        company: input.company?.trim() || null,
        website: input.website?.trim() || null,
        side,
        note: input.note?.trim() || null,
      },
    ],
    "manual",
  );
}
