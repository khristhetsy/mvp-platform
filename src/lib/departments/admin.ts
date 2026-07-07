// Server-side data + mutations for the Feature Controls → Departments admin UI.
// Service-role client (admin-gated at the route layer). Department tables aren't in
// the generated types → loose client.

import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export interface DeptRow { id: string; key: string; name: string; hubKey: string; isAdmin: boolean }
export interface FeatureRow { id: string; key: string; label: string; hubKey: string; path: string; sortOrder: number }
export interface MatrixData {
  departments: DeptRow[];
  features: FeatureRow[];
  grants: Record<string, boolean>; // `${departmentId}:${featureId}` → enabled
}

export async function loadMatrix(): Promise<MatrixData> {
  const [{ data: depts }, { data: feats }, { data: grants }] = await Promise.all([
    db().from("departments").select("id, key, name, hub_key, is_admin").eq("is_active", true).order("is_admin", { ascending: false }).order("name"),
    db().from("features").select("id, key, label, hub_key, path, sort_order").eq("is_active", true).order("hub_key").order("sort_order"),
    db().from("department_features").select("department_id, feature_id, enabled"),
  ]);
  const grantMap: Record<string, boolean> = {};
  for (const g of (grants ?? []) as Array<{ department_id: string; feature_id: string; enabled: boolean }>) {
    grantMap[`${g.department_id}:${g.feature_id}`] = g.enabled;
  }
  return {
    departments: ((depts ?? []) as Array<Record<string, unknown>>).map((d) => ({ id: String(d.id), key: String(d.key), name: String(d.name), hubKey: String(d.hub_key), isAdmin: Boolean(d.is_admin) })),
    features: ((feats ?? []) as Array<Record<string, unknown>>).map((f) => ({ id: String(f.id), key: String(f.key), label: String(f.label), hubKey: String(f.hub_key), path: String(f.path), sortOrder: Number(f.sort_order) })),
    grants: grantMap,
  };
}

export async function batchUpsertGrants(rows: Array<{ departmentId: string; featureId: string; enabled: boolean }>, actorId: string): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({ department_id: r.departmentId, feature_id: r.featureId, enabled: r.enabled, updated_by: actorId, updated_at: new Date().toISOString() }));
  const { error } = await db().from("department_features").upsert(payload, { onConflict: "department_id,feature_id" });
  if (error) throw new Error(error.message);
}

export interface MemberRow { userId: string; name: string | null; email: string | null; departmentIds: string[] }

export async function listMembers(): Promise<MemberRow[]> {
  // Internal users = admin/analyst profiles. Show each with their department chips.
  const [{ data: profiles }, { data: members }] = await Promise.all([
    db().from("profiles").select("id, full_name, email, role").in("role", ["admin", "analyst"]).order("full_name"),
    db().from("department_members").select("user_id, department_id"),
  ]);
  const byUser = new Map<string, string[]>();
  for (const m of (members ?? []) as Array<{ user_id: string; department_id: string }>) {
    byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), m.department_id]);
  }
  return ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({
    userId: p.id, name: p.full_name, email: p.email, departmentIds: byUser.get(p.id) ?? [],
  }));
}

export async function setMembership(userId: string, departmentId: string, member: boolean, actorId: string): Promise<void> {
  if (member) {
    const { error } = await db().from("department_members").upsert({ user_id: userId, department_id: departmentId, added_by: actorId }, { onConflict: "user_id,department_id" });
    if (error) throw new Error(error.message);
  } else {
    // Guard: never remove the last member of the Admin department.
    const { data: dept } = await db().from("departments").select("is_admin").eq("id", departmentId).maybeSingle();
    if (dept?.is_admin) {
      const { count } = await db().from("department_members").select("user_id", { count: "exact", head: true }).eq("department_id", departmentId);
      if ((count ?? 0) <= 1) throw new Error("Cannot remove the last member of the Admin department.");
    }
    const { error } = await db().from("department_members").delete().eq("user_id", userId).eq("department_id", departmentId);
    if (error) throw new Error(error.message);
  }
}

export interface AuditRow { id: number; actorName: string | null; action: string; departmentName: string | null; featureLabel: string | null; targetName: string | null; createdAt: string }

export async function listAudit(limit = 100, offset = 0): Promise<AuditRow[]> {
  const { data } = await db().from("department_audit_log").select("id, actor_id, action, department_id, feature_id, target_user_id, created_at").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  // Resolve names in bulk.
  const ids = new Set<string>();
  rows.forEach((r) => { [r.actor_id, r.target_user_id].forEach((v) => v && ids.add(String(v))); });
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter(Boolean).map(String))];
  const featIds = [...new Set(rows.map((r) => r.feature_id).filter(Boolean).map(String))];
  const [{ data: people }, { data: depts }, { data: feats }] = await Promise.all([
    ids.size ? db().from("profiles").select("id, full_name, email").in("id", [...ids]) : Promise.resolve({ data: [] }),
    deptIds.length ? db().from("departments").select("id, name").in("id", deptIds) : Promise.resolve({ data: [] }),
    featIds.length ? db().from("features").select("id, label").in("id", featIds) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map<string, string | null>((people ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email]));
  const dMap = new Map<string, string>((depts ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));
  const fMap = new Map<string, string>((feats ?? []).map((f: { id: string; label: string }) => [f.id, f.label]));
  return rows.map((r) => ({
    id: Number(r.id),
    actorName: r.actor_id ? pMap.get(String(r.actor_id)) ?? "—" : "—",
    action: String(r.action),
    departmentName: r.department_id ? dMap.get(String(r.department_id)) ?? null : null,
    featureLabel: r.feature_id ? fMap.get(String(r.feature_id)) ?? null : null,
    targetName: r.target_user_id ? pMap.get(String(r.target_user_id)) ?? null : null,
    createdAt: String(r.created_at),
  }));
}
