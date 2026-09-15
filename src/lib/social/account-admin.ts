/**
 * Multi-account admin for the Social Hub: label / assignee / default flag on
 * social_accounts, disconnect, and one-time connect invites (a link a staff member
 * opens to authorize their own LinkedIn). Service-role only.
 *
 * "Connect metadata" (label, assignee, default, invite) travels through the OAuth
 * round-trip in a short-lived cookie; the callback applies it after the upsert.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const CONNECT_META_COOKIE = "social_connect_meta";
export const INVITE_TTL_DAYS = 7;

export type ConnectMeta = { label?: string | null; assignedTo?: string | null; isDefault?: boolean; inviteId?: string | null };

export function encodeConnectMeta(meta: ConnectMeta): string {
  return Buffer.from(JSON.stringify(meta)).toString("base64url");
}
export function decodeConnectMeta(raw: string | undefined): ConnectMeta {
  if (!raw) return {};
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ConnectMeta;
    return {
      label: typeof v.label === "string" ? v.label.slice(0, 80) : null,
      assignedTo: typeof v.assignedTo === "string" ? v.assignedTo : null,
      isDefault: v.isDefault === true,
      inviteId: typeof v.inviteId === "string" ? v.inviteId : null,
    };
  } catch { return {}; }
}

export type AccountPatch = { label?: string | null; assignedTo?: string | null; isDefault?: boolean };

/** Set label / assignee / default on an account. Making one default clears the previous default. */
export async function updateAccount(id: string, patch: AccountPatch): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) row.label = patch.label?.trim() || null;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.isDefault === true) {
    const { error } = await db().from("social_accounts").update({ is_default: false }).eq("is_default", true).neq("id", id);
    if (error) throw new Error(`Failed to clear default: ${error.message}`);
  }
  const { error } = await db().from("social_accounts").update(row).eq("id", id);
  if (error) throw new Error(`Failed to update account: ${error.message}`);
}

/** Applied by the OAuth callback right after the upsert; also closes the invite if one was used. */
export async function applyConnectMeta(accountId: string, meta: ConnectMeta, connectedBy: string): Promise<void> {
  await updateAccount(accountId, { label: meta.label ?? undefined, assignedTo: meta.assignedTo ?? undefined, isDefault: meta.isDefault ? true : undefined });
  const { error } = await db().from("social_accounts").update({ connected_by: connectedBy, disconnected_at: null }).eq("id", accountId);
  if (error) throw new Error(`Failed to mark connector: ${error.message}`);
  if (meta.inviteId) {
    await db().from("social_connect_invites").update({ used_at: new Date().toISOString(), account_id: accountId }).eq("id", meta.inviteId).is("used_at", null);
  }
}

/** Queued variants that would be affected by disconnecting this account. */
export async function queuedCountForAccount(id: string): Promise<number> {
  const { count, error } = await db().from("social_variants").select("id", { count: "exact", head: true }).eq("account_id", id).eq("status", "queued");
  if (error) throw new Error(`Failed to count queued posts: ${error.message}`);
  return count ?? 0;
}

/** Drop the tokens, mark disconnected, and skip anything still queued for it. */
export async function disconnectAccount(id: string): Promise<{ skipped: number }> {
  const skipped = await queuedCountForAccount(id);
  const now = new Date().toISOString();
  const { error: vErr } = await db().from("social_variants")
    .update({ status: "skipped", error: "Account disconnected.", updated_at: now }).eq("account_id", id).eq("status", "queued");
  if (vErr) throw new Error(`Failed to skip queued posts: ${vErr.message}`);
  const { error } = await db().from("social_accounts")
    .update({ access_token: null, refresh_token: null, status: "disconnected", is_default: false, disconnected_at: now, updated_at: now }).eq("id", id);
  if (error) throw new Error(`Failed to disconnect: ${error.message}`);
  return { skipped };
}

// ── Pickers + drawer data ───────────────────────────────────────────────────
export type StaffOption = { id: string; name: string; email: string | null };

/** Staff (admin/analyst) for the "Assigned to" picker, with email so an invite can be prefilled. */
export async function listStaff(): Promise<StaffOption[]> {
  const { data } = await db().from("profiles").select("id, full_name, email, role").in("role", ["admin", "analyst"]).order("full_name", { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
    .map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? "Staff", email: p.email ?? null }));
}

export type AccountActivity = {
  published30: number; queued: number; failed30: number;
  recent: Array<{ id: string; body: string; status: string; at: string | null; url: string | null }>;
};

/** What this account has been doing: 30-day counts plus the last few variants. */
export async function accountActivity(id: string): Promise<AccountActivity> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: rows }, { count: queued }] = await Promise.all([
    db().from("social_variants").select("id, body, status, scheduled_at, published_at, updated_at, url")
      .eq("account_id", id).neq("status", "archived").gte("updated_at", since).order("updated_at", { ascending: false }).limit(200),
    db().from("social_variants").select("id", { count: "exact", head: true }).eq("account_id", id).eq("status", "queued"),
  ]);
  const all = (rows ?? []) as Array<{ id: string; body: string; status: string; scheduled_at: string | null; published_at: string | null; updated_at: string; url: string | null }>;
  return {
    published30: all.filter((r) => r.status === "published").length,
    queued: queued ?? 0,
    failed30: all.filter((r) => r.status === "failed").length,
    recent: all.slice(0, 5).map((r) => ({ id: r.id, body: r.body, status: r.status, at: r.published_at ?? r.scheduled_at ?? r.updated_at, url: r.url })),
  };
}

// ── Invites ─────────────────────────────────────────────────────────────────
export type ConnectInvite = {
  id: string; platform: string; label: string | null; assigned_to: string | null; email: string; is_default: boolean;
  expires_at: string; used_at: string | null; created_at: string;
};

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvite(input: { platform: "linkedin" | "facebook"; label: string | null; assignedTo: string | null; email: string; isDefault: boolean; createdBy: string }): Promise<{ id: string; token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
  // One open invite per email+platform: replace any earlier unused one.
  await db().from("social_connect_invites").delete().eq("email", input.email.toLowerCase()).eq("platform", input.platform).is("used_at", null);
  const { data, error } = await db().from("social_connect_invites").insert({
    token_hash: hashInviteToken(token), platform: input.platform, label: input.label, assigned_to: input.assignedTo,
    email: input.email.toLowerCase(), is_default: input.isDefault, created_by: input.createdBy, expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new Error(`Failed to create invite: ${error.message}`);
  return { id: (data as { id: string }).id, token, expiresAt };
}

/** Open (unused, unexpired) invite for a raw link token, or null. */
export async function findOpenInvite(token: string): Promise<ConnectInvite | null> {
  const { data } = await db().from("social_connect_invites")
    .select("id, platform, label, assigned_to, email, is_default, expires_at, used_at, created_at")
    .eq("token_hash", hashInviteToken(token)).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  return (data as ConnectInvite | null) ?? null;
}

export async function listOpenInvites(): Promise<ConnectInvite[]> {
  const { data } = await db().from("social_connect_invites")
    .select("id, platform, label, assigned_to, email, is_default, expires_at, used_at, created_at")
    .is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  return (data ?? []) as ConnectInvite[];
}

export async function deleteInvite(id: string): Promise<void> {
  const { error } = await db().from("social_connect_invites").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete invite: ${error.message}`);
}
