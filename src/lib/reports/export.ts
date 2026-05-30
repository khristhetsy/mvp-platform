function escapeCsvCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((key) => escapeCsvCell(row[key])).join(",")),
  ];
  return lines.join("\n");
}

export function reportFilename(reportType: string, format: "json" | "csv" | "pdf") {
  const stamp = new Date().toISOString().slice(0, 10);
  return `capitalos-${reportType}-${stamp}.${format}`;
}
