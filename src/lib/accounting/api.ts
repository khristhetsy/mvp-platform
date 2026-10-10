import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";

/** Accounting is staff only and sits behind the same permission as Billing. */
export async function accountingGuard(): Promise<{ userId: string } | { error: Response }> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return { error: auth.error as Response };
  return { userId: auth.userId };
}

export function fail(err: unknown, status = 400): Response {
  return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong. Try again." }, { status });
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => ({}));
  return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
}
