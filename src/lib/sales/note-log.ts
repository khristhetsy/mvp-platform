// iCapOS internal notes are stored as one text column (crm_contact_annotations.notes),
// one entry per "[YYYY-MM-DD] text" stamp (see appendContactNote). These helpers split
// that text into entries and rebuild it, so a single entry can be edited or deleted
// without touching the others. Untouched entries round-trip byte for byte.

export type NoteEntry = { index: number; date: string | null; text: string; raw: string };

const STAMP = /^\[(\d{4}-\d{2}-\d{2})\] ?(.*)$/;

/** Split the stored notes text into entries, oldest first. */
export function parseNoteLog(blob: string | null | undefined): NoteEntry[] {
  if (!blob) return [];
  const out: NoteEntry[] = [];
  let cur: { date: string | null; lines: string[]; rawLines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const raw = cur.rawLines.join("\n");
    if (raw.trim() !== "" || cur.date) out.push({ index: out.length, date: cur.date, text: cur.lines.join("\n"), raw });
  };
  for (const line of blob.split("\n")) {
    const m = STAMP.exec(line);
    if (m) {
      flush();
      cur = { date: m[1], lines: [m[2]], rawLines: [line] };
    } else if (cur) {
      cur.lines.push(line);
      cur.rawLines.push(line);
    } else {
      cur = { date: null, lines: [line], rawLines: [line] };
    }
  }
  flush();
  return out;
}

function join(entries: { raw: string }[]): string {
  return entries.map((e) => e.raw).join("\n");
}

/** Notes text with entry `index` replaced by `text` (date stamp kept). */
export function editNoteEntry(blob: string | null | undefined, index: number, text: string): string {
  const entries = parseNoteLog(blob);
  const e = entries[index];
  if (!e) throw new Error("Note not found.");
  const clean = text.trim();
  const raw = e.date ? `[${e.date}] ${clean}` : clean;
  return join(entries.map((x) => (x.index === index ? { raw } : x)));
}

/** Notes text with entry `index` removed. */
export function deleteNoteEntry(blob: string | null | undefined, index: number): string {
  const entries = parseNoteLog(blob);
  if (!entries[index]) throw new Error("Note not found.");
  return join(entries.filter((x) => x.index !== index));
}
