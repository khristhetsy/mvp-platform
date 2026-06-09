import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedImportRow } from "@/lib/imports/types";

const EXCEL_WORKER_SCRIPT = `
const ExcelJS = require("exceljs");
const fs = require("fs");

function normalizeCell(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) {
    if ("result" in value && value.result != null) return normalizeCell(value.result);
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("").trim();
    }
  }
  return String(value).trim();
}

function sheetToMatrix(sheet) {
  const matrix = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values ?? [];
    const line = values.slice(1).map((cell) => normalizeCell(cell));
    matrix.push(line);
  });
  return matrix;
}

async function parseXlsxBuffer(bufferBase64) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bufferBase64, "base64"));
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  return sheetToMatrix(sheet);
}

async function buildXlsxBuffer(rows, sheetName) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(headers.map((header) => row[header] ?? ""));
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}

(async () => {
  const input = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const result =
    input.op === "parse"
      ? await parseXlsxBuffer(input.bufferBase64)
      : await buildXlsxBuffer(input.rows, input.sheetName);
  fs.writeFileSync(process.argv[2], JSON.stringify({ ok: true, result }));
})().catch((error) => {
  fs.writeFileSync(
    process.argv[2],
    JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
  );
  process.exit(1);
});
`;

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record && record.result != null) return normalizeCell(record.result);
    if ("text" in record && record.text != null) return String(record.text).trim();
    if ("richText" in record && Array.isArray(record.richText)) {
      return (record.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("").trim();
    }
  }
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

function runExcelWorker<T>(payload: unknown): T {
  const dir = mkdtempSync(join(tmpdir(), "capitalos-excel-"));
  const inPath = join(dir, "in.json");
  const outPath = join(dir, "out.json");

  writeFileSync(inPath, JSON.stringify(payload));

  const proc = spawnSync(process.execPath, ["-e", EXCEL_WORKER_SCRIPT, inPath, outPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  try {
    if (proc.error) {
      throw proc.error;
    }
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || "Excel worker failed");
    }

    const parsed = JSON.parse(readFileSync(outPath, "utf8")) as
      | { ok: true; result: T }
      | { ok: false; error: string };

    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    return parsed.result;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

  const matrix = runExcelWorker<unknown[][]>({
    op: "parse",
    bufferBase64: buffer.toString("base64"),
  });

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
  const bufferBase64 = runExcelWorker<string>({
    op: "write",
    rows,
    sheetName,
  });

  return Buffer.from(bufferBase64, "base64");
}
