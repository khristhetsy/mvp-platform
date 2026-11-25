/** Pure CSV builder for the Learning dashboard modules export. */
export type ModuleExportRow = Readonly<{
  module: string;
  slug: string;
  stage: string;
  lessons: number;
  linkedCourse: string;
  status: string;
}>;

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV of the modules currently shown. */
export function toModulesCsv(rows: readonly ModuleExportRow[]): string {
  const head = ["Module", "Slug", "Stage", "Lessons", "Linked course", "Status"];
  const lines = rows.map((r) => [r.module, r.slug, r.stage, r.lessons, r.linkedCourse, r.status].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}
