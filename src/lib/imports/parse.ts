import * as XLSX from "xlsx";
import type { ParsedImportRow } from "@/lib/imports/types";

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function rowsFromMatrix(matrix: unknown[][]): { headers: string[]; rows: Record<string, string>[] } {
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = (matrix[0] ?? []).map((cell) => normalizeCell(cell));
  const headers = headerRow.map((header, index) => header || `column_${index + 1}`);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    const record: Record<string, string> = {};
    let hasValue = false;

    for (let col = 0; col < headers.length; col += 1) {
      const value = normalizeCell(line[col]);
      record[headers[col]] = value;
      if (value) hasValue = true;
    }

    if (hasValue) {
      rows.push(record);
    }
  }

  return { headers, rows };
}

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map((header, index) => header || `column_${index + 1}`);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseLine(lines[i]);
    const record: Record<string, string> = {};
    let hasValue = false;
    for (let col = 0; col < headers.length; col += 1) {
      const value = values[col] ?? "";
      record[headers[col]] = value;
      if (value) hasValue = true;
    }
    if (hasValue) rows.push(record);
  }

  return { headers, rows };
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
): { headers: string[]; rows: Record<string, string>[] } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsvText(buffer.toString("utf-8"));
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return rowsFromMatrix(matrix);
}

export function toParsedImportRows(rows: Record<string, string>[]): ParsedImportRow[] {
  return rows.map((raw, index) => ({
    rowNumber: index + 1,
    raw,
    mapped: {},
  }));
}

export function rowsToWorkbookBuffer(rows: Record<string, unknown>[], sheetName = "Export"): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
