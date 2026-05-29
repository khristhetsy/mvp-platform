import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    return auth.error as NextResponse;
  }

  const serviceRoleKeyExists = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const companiesRead = await auth.supabase.from("companies").select("id", { count: "exact", head: true });

  let writeCheck: { ok: boolean; message: string };

  if (!serviceRoleKeyExists) {
    writeCheck = { ok: false, message: "write check skipped (service role key missing)" };
  } else {
    const { error: writeError } = await auth.supabase.from("audit_logs").insert({
      user_id: auth.profile.id,
      action: "admin.health_check",
      entity_type: "system",
      entity_id: null,
      metadata: { source: "GET /api/admin/health" },
    });

    writeCheck = writeError
      ? { ok: false, message: writeError.message }
      : { ok: true, message: "service role write ok (audit_logs insert)" };
  }

  const checks = {
    authenticated: true,
    userId: auth.profile.id,
    role: auth.profile.role,
    serviceRoleKeyExists,
    companiesRead: {
      ok: !companiesRead.error,
      count: companiesRead.count ?? 0,
      error: companiesRead.error?.message ?? null,
    },
    writeCheck,
  };

  const ok =
    checks.authenticated &&
    checks.serviceRoleKeyExists &&
    checks.companiesRead.ok &&
    checks.writeCheck.ok;

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
