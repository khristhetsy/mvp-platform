import pg from "pg";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { REQUIRED_MIGRATION_FLOOR } from "@/lib/operations/migration-verification";

export type SecurityCheckResult = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type SecurityVerificationSummary = {
  ok: boolean;
  checks: SecurityCheckResult[];
  databaseQueryable: boolean;
};

const HARDENING_TRIGGERS = [
  "profiles_guard_role_escalation",
  "investor_profiles_guard_approval_fields",
] as const;

const HARDENING_POLICIES = [
  { table: "documents", policy: "documents_select_investor_related" },
] as const;

const DEPRECATED_POLICIES = [
  { table: "documents", policy: "documents_select_investor_approved" },
] as const;

async function queryDatabaseChecks(): Promise<{
  databaseQueryable: boolean;
  triggers: Set<string>;
  policies: Set<string>;
  tables: Set<string>;
  functions: Set<string>;
  error: string | null;
}> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      databaseQueryable: false,
      triggers: new Set(),
      policies: new Set(),
      tables: new Set(),
      functions: new Set(),
      error: "DATABASE_URL not configured",
    };
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();

    const [triggerRes, policyRes, tableRes, functionRes] = await Promise.all([
      client.query<{ name: string }>(
        `select tgname as name
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal`,
      ),
      client.query<{ name: string }>(
        `select policyname as name
         from pg_policies
         where schemaname = 'public'`,
      ),
      client.query<{ name: string }>(
        `select tablename as name
         from pg_tables
         where schemaname = 'public'`,
      ),
      client.query<{ name: string }>(
        `select proname as name
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'`,
      ),
    ]);

    return {
      databaseQueryable: true,
      triggers: new Set(triggerRes.rows.map((row) => row.name)),
      policies: new Set(policyRes.rows.map((row) => row.name)),
      tables: new Set(tableRes.rows.map((row) => row.name)),
      functions: new Set(functionRes.rows.map((row) => row.name)),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database verification query failed";
    return {
      databaseQueryable: true,
      triggers: new Set(),
      policies: new Set(),
      tables: new Set(),
      functions: new Set(),
      error: message,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function verifyDealRoomsAccessible() {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("deal_rooms").select("id", { head: true, count: "exact" });
  return !error;
}

export async function runSecurityVerification(): Promise<SecurityVerificationSummary> {
  const checks: SecurityCheckResult[] = [];
  const db = await queryDatabaseChecks();

  if (!db.databaseQueryable) {
    checks.push({
      id: "database",
      label: "Database verification",
      ok: false,
      detail: db.error ?? "DATABASE_URL required for security policy checks",
    });
  } else if (db.error) {
    checks.push({
      id: "database",
      label: "Database verification",
      ok: false,
      detail: db.error,
    });
  } else {
    for (const triggerName of HARDENING_TRIGGERS) {
      const present = db.triggers.has(triggerName);
      checks.push({
        id: `trigger_${triggerName}`,
        label: `Trigger: ${triggerName}`,
        ok: present,
        detail: present ? "Active" : `Missing — apply ${REQUIRED_MIGRATION_FLOOR}`,
      });
    }

    for (const { table, policy } of HARDENING_POLICIES) {
      const present = db.policies.has(policy);
      checks.push({
        id: `policy_${policy}`,
        label: `RLS policy: ${policy}`,
        ok: present,
        detail: present ? `Present on ${table}` : `Missing — investor document access may be too broad`,
      });
    }

    for (const { table, policy } of DEPRECATED_POLICIES) {
      const present = db.policies.has(policy);
      checks.push({
        id: `deprecated_${policy}`,
        label: `Deprecated policy removed: ${policy}`,
        ok: !present,
        detail: present
          ? `Still present on ${table} — replace with relationship-scoped access`
          : "Removed (expected)",
      });
    }

    const investorAccessFn = db.functions.has("investor_has_company_document_access");
    checks.push({
      id: "fn_investor_document_access",
      label: "Investor document access function",
      ok: investorAccessFn,
      detail: investorAccessFn ? "Present" : `Missing — apply ${REQUIRED_MIGRATION_FLOOR}`,
    });
  }

  const dealRoomsTableOk = db.tables.has("deal_rooms") || (await verifyDealRoomsAccessible());
  checks.push({
    id: "deal_rooms_table",
    label: "Deal rooms schema",
    ok: dealRoomsTableOk,
    detail: dealRoomsTableOk ? "deal_rooms reachable" : "deal_rooms missing — apply 0055_deal_rooms_phase1",
  });

  const profileRoleOk = checks.find((c) => c.id === "trigger_profiles_guard_role_escalation")?.ok ?? false;
  const investorApprovalOk =
    checks.find((c) => c.id === "trigger_investor_profiles_guard_approval_fields")?.ok ?? false;
  const documentPolicyOk = checks.find((c) => c.id === "policy_documents_select_investor_related")?.ok ?? false;
  const deprecatedRemoved = checks.find((c) => c.id === "deprecated_documents_select_investor_approved")?.ok ?? false;

  checks.unshift({
    id: "profile_role_escalation",
    label: "Profile role escalation protection",
    ok: profileRoleOk,
    detail: profileRoleOk
      ? "Self-service role changes are guarded"
      : "Not verified — migration 0056 may be missing",
  });

  checks.unshift({
    id: "investor_self_approval",
    label: "Investor self-approval protection",
    ok: investorApprovalOk,
    detail: investorApprovalOk
      ? "Approval fields guarded for non-staff updates"
      : "Not verified — migration 0056 may be missing",
  });

  checks.unshift({
    id: "document_access_policy",
    label: "Investor document access policy",
    ok: documentPolicyOk && deprecatedRemoved,
    detail:
      documentPolicyOk && deprecatedRemoved
        ? "Relationship-scoped investor document reads"
        : "Broad or legacy investor document policy detected",
  });

  const ok = checks.every((check) => check.ok);

  return {
    ok,
    checks,
    databaseQueryable: db.databaseQueryable,
  };
}
