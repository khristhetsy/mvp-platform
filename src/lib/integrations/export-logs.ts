import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listRecentDeliveryLogs } from "@/lib/integrations/health";

export type IntegrationDeliveryExportRow = {
  id: string;
  provider: string;
  event_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  response_code: number | null;
  error_message: string | null;
  next_retry_at: string | null;
  created_at: string;
  delivered_at: string | null;
};

export async function fetchDeliveryLogsForExport(limit = 500): Promise<IntegrationDeliveryExportRow[]> {
  const rows = await listRecentDeliveryLogs(limit);
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    event_type: r.event_type,
    status: r.status,
    attempt_count: r.attempt_count,
    max_attempts: r.max_attempts,
    response_code: r.response_code,
    error_message: r.error_message,
    next_retry_at: r.next_retry_at,
    created_at: r.created_at,
    delivered_at: r.delivered_at,
  }));
}

export function deliveryLogsToCsv(rows: IntegrationDeliveryExportRow[]): string {
  const headers = [
    "id",
    "provider",
    "event_type",
    "status",
    "attempt_count",
    "max_attempts",
    "response_code",
    "error_message",
    "next_retry_at",
    "created_at",
    "delivered_at",
  ];
  const escape = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h as keyof IntegrationDeliveryExportRow] ?? null)).join(","));
  }
  return lines.join("\n");
}

export async function buildDeliveryLogsExport(format: "csv" | "json") {
  const rows = await fetchDeliveryLogsForExport();
  const exportedAt = new Date().toISOString();
  if (format === "csv") {
    return {
      contentType: "text/csv; charset=utf-8",
      filename: `integration-deliveries-${exportedAt.slice(0, 10)}.csv`,
      body: deliveryLogsToCsv(rows),
    };
  }
  return {
    contentType: "application/json",
    filename: `integration-deliveries-${exportedAt.slice(0, 10)}.json`,
    body: JSON.stringify({ exportedAt, count: rows.length, deliveries: rows }, null, 2),
  };
}
