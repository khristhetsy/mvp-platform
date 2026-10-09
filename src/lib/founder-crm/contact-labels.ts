/** Display labels for founder contacts. Pure, so both the server loader and
 *  the My contacts client can use them. */

export type MyContactSource = "Introduced" | "Imported" | "Added by you" | "From investor directory";

const IMPORT_SOURCES = new Set(["csv_import", "import", "csv", "gmail", "outlook", "google", "linkedin"]);

export function contactSourceLabel(source: string | null | undefined): MyContactSource {
  const s = (source ?? "").toLowerCase();
  // Public investor data imported from the iCapOS investor directory (outside the iCFO network).
  if (s === "directory") return "From investor directory";
  if (IMPORT_SOURCES.has(s) || s.endsWith("_import")) return "Imported";
  if (s === "introduction" || s === "intro") return "Introduced";
  return "Added by you";
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  researching: "Researching",
  selected: "Selected",
  contacted: "Contacted",
  responded: "Responded",
  meeting_scheduled: "Meeting scheduled",
  not_interested: "Not interested",
};

export function contactStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}
