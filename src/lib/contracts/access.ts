// Who may do what with SPV contracts (build spec §6). Fail closed: anyone who
// is not staff, or cannot see the contact under Sales Hub scoping, gets nothing.
//
//   Send, edit prospect copy, duplicate   staff who can see the contact
//   Upload or replace a master            manage_settings
//   Cancel or archive                     manage_settings, or the document's creator
//   Delete                                manage_settings (logged)

import "server-only";
import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { getSalesScope, type SalesScope } from "@/lib/sales/scope";
import type { Profile } from "@/lib/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

export type ContractsActor = {
  userId: string;
  profile: Profile;
  actorLabel: string;
  scope: SalesScope;
  /** manage_settings: masters, delete, cancel and archive anyone's records. */
  isAdmin: boolean;
  db: Db;
};

export async function requireContractsApi(): Promise<{ actor: ContractsActor } | { error: Response }> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const profile = auth.profile;
  const db = createServiceRoleClient();
  const [eff, scope] = await Promise.all([getEffectivePermissions(db, profile.id, profile), getSalesScope(profile)]);
  return {
    actor: {
      userId: profile.id,
      profile,
      actorLabel: profile.email ?? profile.full_name ?? profile.id,
      scope,
      isAdmin: eff.isSuperAdmin || eff.permissions.includes("manage_settings"),
      db,
    },
  };
}

/** Contact visible to this actor under Sales Hub scoping. */
export async function canSeeContact(actor: ContractsActor, contactId: string): Promise<boolean> {
  if (actor.scope.canSeeAllContacts) return true;
  const { data } = await actor.db.from("crm_contacts").select("assignee_ids").eq("id", contactId).maybeSingle();
  const ids = (data?.assignee_ids as string[] | null) ?? [];
  return ids.includes(actor.userId);
}

export function canCancelOrArchive(actor: ContractsActor, createdBy: string): boolean {
  return actor.isAdmin || createdBy === actor.userId;
}

export function forbidden(message = "You don't have access to this contract.") {
  return NextResponse.json({ error: message }, { status: 403 });
}
export function notFound(message = "Not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}
export function bad(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}
