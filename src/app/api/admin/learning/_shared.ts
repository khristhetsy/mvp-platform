import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { isSuperAdmin } from "@/lib/rbac/effective-permissions";

export type StaffAuth = Awaited<ReturnType<typeof requireStaffApi>>;

export async function requireLearningStaff() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth;
  return auth;
}

export function ensureCanPublish(profile: { role?: string | null; is_super_admin?: boolean | null }) {
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "admin" || isSuperAdmin(profile)) return;
  throw new Error("Insufficient permissions to publish/approve/archive content.");
}

export function ensureCanIssueCertificates(profile: { role?: string | null; is_super_admin?: boolean | null }) {
  const role = String(profile.role ?? "").toLowerCase();
  if (role === "admin" || isSuperAdmin(profile)) return;
  throw new Error("Insufficient permissions to issue certificates.");
}

export function jsonOk(payload: unknown) {
  return NextResponse.json(payload, { status: 200 });
}

export function jsonBadRequest(error: unknown, status = 400) {
  return NextResponse.json({ error: apiErrorMessage(error) }, { status });
}

