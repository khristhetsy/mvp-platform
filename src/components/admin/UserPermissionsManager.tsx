"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  INTERNAL_PERMISSION_LABELS,
  INTERNAL_ROLE_LABELS,
  type InternalPermission,
  type InternalRoleSlug,
} from "@/lib/rbac/constants";
import type { InternalUserSummary } from "@/lib/rbac/types";

type CatalogRole = {
  id: string;
  slug: InternalRoleSlug;
  label: string;
  rank: number;
};

type CatalogPermission = {
  id: string;
  slug: InternalPermission;
  label: string;
};

type PermissionsPayload = {
  users: InternalUserSummary[];
  roles: CatalogRole[];
  permissions: CatalogPermission[];
  rolePermissions: Record<string, InternalPermission[]>;
  actor: {
    userId: string;
    isSuperAdmin: boolean;
    roleSlug: InternalRoleSlug | null;
    permissions: InternalPermission[];
  };
};

function displayName(user: InternalUserSummary) {
  return user.full_name?.trim() || user.email || user.id;
}

export function UserPermissionsManager() {
  const t = useTranslations("usersAdmin.permissions");
  const [payload, setPayload] = useState<PermissionsPayload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [roleSlug, setRoleSlug] = useState<InternalRoleSlug>("regular_user");
  const [isActive, setIsActive] = useState(true);
  const [overrideState, setOverrideState] = useState<Record<InternalPermission, "inherit" | "grant" | "revoke">>(
    {} as Record<InternalPermission, "inherit" | "grant" | "revoke">,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "analyst">("analyst");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteEmailRef = useRef<HTMLInputElement>(null);

  const selectedUser = useMemo(
    () => payload?.users.find((u) => u.id === selectedUserId) ?? null,
    [payload, selectedUserId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/permissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load permissions.");
      setPayload(data as PermissionsPayload);
      if (!selectedUserId && data.users?.length) {
        setSelectedUserId(data.users[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- initial permissions catalog load */
    void load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  useEffect(() => {
    if (!selectedUser || !payload) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset permission editor when selected user changes */
    setRoleSlug(selectedUser.roleSlug ?? "regular_user");
    setIsActive(selectedUser.isActive);
    const next = {} as Record<InternalPermission, "inherit" | "grant" | "revoke">;
    for (const perm of payload.permissions.map((p) => p.slug)) {
      const override = selectedUser.overrides.find((o) => o.permission === perm);
      next[perm] = override ? (override.granted ? "grant" : "revoke") : "inherit";
    }
    setOverrideState(next);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedUser, payload]);

  const previewPermissions = useMemo(() => {
    if (!payload) return [];
    if (roleSlug === "super_admin") return payload.permissions.map((p) => p.slug);
    const base = new Set(payload.rolePermissions[roleSlug] ?? []);
    for (const perm of payload.permissions.map((p) => p.slug)) {
      const mode = overrideState[perm] ?? "inherit";
      if (mode === "grant") base.add(perm);
      if (mode === "revoke") base.delete(perm);
    }
    return payload.permissions.map((p) => p.slug).filter((p) => base.has(p));
  }, [payload, roleSlug, overrideState]);

  const assignableRoles = useMemo(() => {
    if (!payload) return [];
    if (payload.actor.isSuperAdmin) return payload.roles;
    const actorRank = payload.roles.find((r) => r.slug === payload.actor.roleSlug)?.rank ?? 0;
    return payload.roles.filter((r) => r.rank < actorRank && r.slug !== "super_admin");
  }, [payload]);

  const canEditSelected = useMemo(() => {
    if (!payload || !selectedUser) return false;
    if (payload.actor.isSuperAdmin) return true;
    if (selectedUser.isSuperAdmin) return false;
    const actorRank = payload.roles.find((r) => r.slug === payload.actor.roleSlug)?.rank ?? 0;
    const targetRank = payload.roles.find((r) => r.slug === (selectedUser.roleSlug ?? "regular_user"))?.rank ?? 0;
    return actorRank > targetRank;
  }, [payload, selectedUser]);

  const save = async () => {
    if (!selectedUser || !payload) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const overrides = payload.permissions
        .map((p) => p.slug)
        .map((permission) => {
          const mode = overrideState[permission] ?? "inherit";
          return {
            permission,
            granted: mode === "inherit" ? null : mode === "grant",
          };
        })
        .filter((o) => o.granted !== null);

      const res = await fetch(`/api/admin/users/permissions/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleSlug, isActive, overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setStatus(t("permsUpdated"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/permissions/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, roleSlug: roleSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deactivate failed.");
      setStatus(t("accessDeactivated"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed.");
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          fullName: inviteFullName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Invite failed.";
        throw new Error(msg);
      }
      setInviteOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("analyst");
      setStatus(t("inviteSent", { email: data.email }));
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setInviteSending(false);
    }
  };

  if (loading && !payload) {
    return <p className="text-sm text-slate-600">{t("loading")}</p>;
  }

  if (error && !payload) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
    );
  }

  if (!payload) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("eyebrow")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            <ShieldCheck className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("desc")}</p>
        </div>
        <button
          type="button"
          onClick={() => { setInviteOpen(true); setInviteError(null); setTimeout(() => inviteEmailRef.current?.focus(), 50); }}
          className="cap-btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {t("inviteStaff")}
        </button>
      </div>

      {/* Invite modal */}
      {inviteOpen ? (
        <>
          <button
            type="button"
            aria-label={t("closeInviteAria")}
            className="fixed inset-0 z-[80] bg-slate-900/40"
            onClick={() => setInviteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            className="fixed left-1/2 top-1/2 z-[90] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="invite-modal-title" className="text-base font-semibold text-slate-950">
                {t("inviteStaff")}
              </h2>
              <button
                type="button"
                aria-label={t("closeAria")}
                onClick={() => setInviteOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                {t("emailLabel")}
                <input
                  ref={inviteEmailRef}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendInvite(); }}
                  placeholder="staff@myicfos.com"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
                />
              </label>

              <label className="grid gap-1 text-xs font-medium text-slate-700">
                {t("fullNameLabel")}
                <input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
                />
              </label>

              <label className="grid gap-1 text-xs font-medium text-slate-700">
                {t("roleLabel")}
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "analyst")}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="admin">{t("roleAdmin")}</option>
                  <option value="analyst">{t("roleAnalyst")}</option>
                </select>
              </label>

              {inviteError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{inviteError}</p>
              ) : null}

              <p className="text-[11px] leading-4 text-slate-500">{t("inviteNote")}</p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={inviteSending || !inviteEmail.trim()}
                  onClick={() => void sendInvite()}
                  className="cap-btn-primary flex-1 rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {inviteSending ? t("sending") : t("sendInvite")}
                </button>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {status ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">{t("internalUsers")}</h2>
            <p className="text-xs text-slate-500">{t("staffAccounts", { n: payload.users.length })}</p>
          </div>
          <ul className="max-h-[32rem] overflow-y-auto p-2">
            {payload.users.map((user) => {
              const active = user.id === selectedUserId;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-[var(--blue)] bg-[var(--blue-muted)] ring-1 ring-[var(--blue)]/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-slate-950">{displayName(user)}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {user.roleLabel ?? INTERNAL_ROLE_LABELS.regular_user}
                      </span>
                      {!user.isActive ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          {t("inactive")}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {selectedUser ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
              <h2 className="text-sm font-semibold text-slate-950">{displayName(selectedUser)}</h2>
              <p className="text-xs text-slate-500">
                {t("profileRole", { role: selectedUser.profileRole ?? "", email: selectedUser.email ?? "" })}
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  {t("internalLevel")}
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={roleSlug}
                    disabled={!canEditSelected}
                    onChange={(e) => setRoleSlug(e.target.value as InternalRoleSlug)}
                  >
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.slug}>
                        {role.label}
                      </option>
                    ))}
                    {payload.actor.isSuperAdmin ? (
                      <option value="super_admin">{INTERNAL_ROLE_LABELS.super_admin}</option>
                    ) : null}
                  </select>
                </label>

                <label className="flex items-end gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={isActive}
                    disabled={!canEditSelected}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  {t("accessActive")}
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
              <h3 className="text-sm font-semibold text-slate-950">{t("permOverrides")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("permOverridesDesc")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {payload.permissions.map((perm) => {
                  const mode = overrideState[perm.slug] ?? "inherit";
                  const roleHas = (payload.rolePermissions[roleSlug] ?? []).includes(perm.slug);
                  return (
                    <div
                      key={perm.id}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <p className="text-xs font-medium text-slate-950">{INTERNAL_PERMISSION_LABELS[perm.slug]}</p>
                      <p className="text-[10px] text-slate-500">{t("roleDefault", { state: roleHas ? t("granted") : t("denied") })}</p>
                      <select
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        value={mode}
                        disabled={!canEditSelected}
                        onChange={(e) =>
                          setOverrideState((prev) => ({
                            ...prev,
                            [perm.slug]: e.target.value as "inherit" | "grant" | "revoke",
                          }))
                        }
                      >
                        <option value="inherit">{t("inheritFromRole")}</option>
                        <option value="grant">{t("grantOverride")}</option>
                        <option value="revoke">{t("revokeOverride")}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-muted)]/40 p-4">
              <h3 className="text-sm font-semibold text-slate-950">{t("effectivePreview")}</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {previewPermissions.length === 0 ? (
                  <li className="text-xs text-slate-600">{t("noPerms")}</li>
                ) : (
                  previewPermissions.map((perm) => (
                    <li
                      key={perm}
                      className="rounded-full border border-[var(--blue)]/15 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-950"
                    >
                      {INTERNAL_PERMISSION_LABELS[perm]}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                disabled={saving || !canEditSelected}
                onClick={() => void save()}
              >
                {saving ? t("saving") : t("saveChanges")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={saving || !canEditSelected || !isActive}
                onClick={() => void deactivate()}
              >
                {t("deactivateAccess")}
              </button>
            </div>

            {!canEditSelected ? (
              <p className="text-xs text-amber-800">{t("cannotEdit")}</p>
            ) : null}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
            {t("selectUser")}
          </div>
        )}
      </div>
    </div>
  );
}
