"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Trash2, UserMinus, AlertTriangle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmailContactButton } from "@/components/email/EmailContactButton";
import type { UserRole } from "@/lib/supabase/types";

type T = (key: string, values?: Record<string, string | number>) => string;
const ROLE_SLUGS = ["founder", "investor", "admin", "analyst"];

type DependentItem = { key: string; label: string; count: number };
type Dependents = { items: DependentItem[]; total: number };

type UserStatus = "active" | "invited" | "inactive";

type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  is_super_admin: boolean;
  last_seen_label: string;
  status: UserStatus;
  created_at: string;
};

type AuditEntry = {
  id: string;
  action: string;
  metadata: Record<string, string> | null;
  created_at: string;
  actor_name: string;
};

const ROLES: UserRole[] = ["founder", "investor", "admin", "analyst"];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#EEEDFE] text-[#3C3489]",
  founder: "bg-[#E1F5EE] text-[#085041]",
  investor: "bg-[#E6F1FB] text-[#0C447C]",
  analyst: "bg-[#FAEEDA] text-[#633806]",
};

const STATUS_COLORS: Record<UserStatus, string> = {
  active: "bg-[#EAF3DE] text-[#3B6D11]",
  invited: "bg-[#FAEEDA] text-[#633806]",
  inactive: "bg-[#F1EFE8] text-[#444441]",
};

function roleLabel(t: T, slug: string | null | undefined): string {
  return slug && ROLE_SLUGS.includes(slug) ? t(`role.${slug}`) : (slug ?? "");
}

function initials(user: ManagedUser) {
  const name = user.full_name ?? user.email ?? "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(role: string) {
  const map: Record<string, string> = {
    admin: "bg-[#EEEDFE] text-[#3C3489]",
    founder: "bg-[#E1F5EE] text-[#085041]",
    investor: "bg-[#E6F1FB] text-[#0C447C]",
    analyst: "bg-[#FAEEDA] text-[#633806]",
    inactive: "bg-[#F1EFE8] text-[#444441]",
  };
  return map[role] ?? "bg-slate-100 text-slate-600";
}

function auditLabel(entry: AuditEntry, t: T): string {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case "admin.user_role_changed":
      return t("audit.roleChanged", { actor: entry.actor_name, target: meta.targetEmail ?? "user", prev: roleLabel(t, meta.previousRole), next: roleLabel(t, meta.newRole) });
    case "admin.user_deactivated":
      return t("audit.deactivated", { actor: entry.actor_name, target: meta.targetName ?? meta.targetEmail ?? "user" });
    case "admin.user_reactivated":
      return t("audit.reactivated", { actor: entry.actor_name, target: meta.targetName ?? meta.targetEmail ?? "user" });
    case "admin.staff_invited":
      return t("audit.invited", { actor: entry.actor_name, email: meta.email ?? "user", role: roleLabel(t, meta.role) });
    default:
      return entry.action;
  }
}

function auditDot(action: string): string {
  if (action === "admin.user_role_changed") return "bg-[#534AB7]";
  if (action === "admin.staff_invited") return "bg-[#1D9E75]";
  if (action === "admin.user_deactivated") return "bg-[#E24B4A]";
  if (action === "admin.user_reactivated") return "bg-[#185FA5]";
  return "bg-slate-400";
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UserManagementClient() {
  const t = useTranslations("usersAdmin.manage");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | UserStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deps, setDeps] = useState<Dependents | null>(null);
  const [depsLoading, setDepsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/manage");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users.");
      setUsers(data.users ?? []);
      setAudit(data.audit ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount + manual reloads: load() owns its own loading/error state. The
  // setState calls happen inside an async callback, not synchronously here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const tab = activeTab === "all" || u.status === activeTab;
      const role = filterRole === "all" || u.role === filterRole;
      const status = filterStatus === "all" || u.status === filterStatus;
      const q = search.trim().toLowerCase();
      const text = !q || (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
      return tab && role && status && text;
    });
  }, [users, activeTab, filterRole, filterStatus, search]);

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    invited: users.filter((u) => u.status === "invited").length,
    inactive: users.filter((u) => u.status === "inactive").length,
  }), [users]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    }
  };

  const patchUser = useCallback(async (userId: string, payload: { role?: UserRole; is_active?: boolean }) => {
    setSaving((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch("/api/admin/users/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setStatusMsg(payload.role ? t("roleUpdated") : payload.is_active ? t("userReactivated") : t("userDeactivated"));
      await load();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg(`${t("errorPrefix")}${err instanceof Error ? err.message : "Update failed."}`);
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }, [load, t]);

  const openDeleteModal = useCallback(async (user: ManagedUser) => {
    setDeleteTarget(user);
    setConfirmEmail("");
    setDeps(null);
    setDepsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/dependents?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (res.ok) setDeps({ items: data.items ?? [], total: data.total ?? 0 });
    } catch {
      // Non-fatal: modal still works, just without the count breakdown.
    } finally {
      setDepsLoading(false);
    }
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    setConfirmEmail("");
    setDeps(null);
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    setSaving((prev) => new Set(prev).add(userId));
    closeDeleteModal();
    try {
      const res = await fetch("/api/admin/users/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setStatusMsg(t("userDeleted"));
      await load();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg(`${t("errorPrefix")}${err instanceof Error ? err.message : "Delete failed."}`);
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }, [load, closeDeleteModal, t]);

  if (loading) return <p className="text-sm text-slate-600">{t("loading")}</p>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("eyebrow")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            <Users className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("desc")}</p>
        </div>
        <a
          href="/admin/users/permissions"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {t("permissionsLink")}
        </a>
      </div>

      {statusMsg ? (
        <p className={`rounded-lg border px-3 py-2 text-sm ${statusMsg.startsWith("Error") ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {statusMsg}
        </p>
      ) : null}

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder={t("searchPh")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline-none"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">{t("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">{t("allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="invited">{t("status.invited")}</option>
          <option value="inactive">{t("status.inactive")}</option>
        </select>
      </div>

      {/* User table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <div className="flex gap-1">
            {(["all", "active", "invited", "inactive"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${activeTab === tab ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:text-slate-700"}`}
              >
                {tab === "all" ? t("all") : t(`status.${tab}`)} ({counts[tab]})
              </button>
            ))}
          </div>
          {selectedIds.size > 0 ? (
            <span className="text-xs text-slate-500">{t("selected", { n: selectedIds.size })}</span>
          ) : null}
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2">
          <input type="checkbox" className="h-4 w-4 rounded" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("colUser")}</span>
          <span className="w-20 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("colRole")}</span>
          <span className="w-20 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("colStatus")}</span>
          <span className="w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("colLastSeen")}</span>
          <span className="w-52"></span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">{t("noUsers")}</div>
        ) : (
          filtered.map((user) => {
            const isSaving = saving.has(user.id);
            const pendingRole = pendingRoles[user.id] ?? user.role;
            const isInactive = !user.is_active;

            return (
              <div
                key={user.id}
                className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50/60 ${isInactive ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={selectedIds.has(user.id)}
                  onChange={() => toggleSelect(user.id)}
                />
                {/* User info */}
                <div className="flex flex-1 items-center gap-2.5 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isInactive ? "bg-slate-100 text-slate-400" : avatarColor(user.role)}`}>
                    {initials(user)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950">{user.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>

                {/* Role badge */}
                <div className="w-20">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-700"}`}>
                    {t(`role.${user.role}`)}
                  </span>
                </div>

                {/* Status badge */}
                <div className="w-20">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.status]}`}>
                    {t(`status.${user.status}`)}
                  </span>
                </div>

                {/* Last seen */}
                <div className="w-24 text-xs text-slate-500">{user.last_seen_label}</div>

                {/* Actions */}
                <div className="flex w-64 shrink-0 items-center justify-end gap-1.5">
                  {isInactive ? (
                    <>
                      <select disabled className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs opacity-40">
                        <option>{t(`role.${user.role}`)}</option>
                      </select>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void patchUser(user.id, { is_active: true })}
                        className="rounded-lg border border-[#B5D4F4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#185FA5] hover:bg-[#E6F1FB] disabled:opacity-50"
                      >
                        {isSaving ? "…" : t("reactivate")}
                      </button>
                    </>
                  ) : user.status === "invited" ? (
                    <>
                      <select
                        value={pendingRole}
                        onChange={(e) => setPendingRoles((p) => ({ ...p, [user.id]: e.target.value as UserRole }))}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void patchUser(user.id, { role: pendingRole })}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {isSaving ? "…" : t("resend")}
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={pendingRole}
                        disabled={user.is_super_admin}
                        onChange={(e) => setPendingRoles((p) => ({ ...p, [user.id]: e.target.value as UserRole }))}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:opacity-40"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={isSaving || user.is_super_admin || pendingRole === user.role}
                        onClick={() => void patchUser(user.id, { role: pendingRole })}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {isSaving ? "…" : t("save")}
                      </button>
                      {/* Primary safe action: reversible deactivation */}
                      {!user.is_super_admin && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void patchUser(user.id, { is_active: false })}
                          title={t("deactivateTitle")}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E4C77A] bg-[#FBF4E2] px-2.5 py-1.5 text-xs font-semibold text-[#7A5409] hover:bg-[#F6E9C7] disabled:opacity-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          {isSaving ? "…" : t("deactivate")}
                        </button>
                      )}
                    </>
                  )}

                  {/* Email this user — admins legitimately hold every user's email */}
                  {user.email ? (
                    <EmailContactButton
                      email={user.email}
                      inboxBasePath="/admin/inbox"
                      label=""
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-[#185FA5]"
                    />
                  ) : null}

                  {/* Permanent delete — secondary, behind a guarded modal */}
                  {!user.is_super_admin && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void openDeleteModal(user)}
                      title={t("deleteTitle")}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D] disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Audit trail */}
      {audit.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">{t("auditTrail")}</h2>
            <span className="text-xs text-slate-500">{t("last20")}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {audit.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${auditDot(entry.action)}`} />
                <div className="flex-1 text-sm text-slate-700">{auditLabel(entry, t)}</div>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">{t("footnote")}</p>

      {/* Guarded permanent-delete modal */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={closeDeleteModal}>
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCEBEB] text-[#A32D2D]">
                  <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">{t("deletePermanently")}</h2>
                  <p className="text-xs text-slate-500">{t("cannotUndo")}</p>
                </div>
              </div>
              <button type="button" onClick={closeDeleteModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-slate-700">
                {t("deleteBodyPre")}<span className="font-semibold text-slate-950">{deleteTarget.full_name ?? deleteTarget.email}</span>{t("deleteBodyMid")}<span className="font-semibold">{t("deactivateWord")}</span>{t("deleteBodyPost")}
              </p>

              {/* Blast radius */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("whatDeleted")}</p>
                {depsLoading ? (
                  <p className="text-sm text-slate-500">{t("counting")}</p>
                ) : deps && deps.total > 0 ? (
                  <ul className="space-y-1">
                    {deps.items.filter((i) => i.count > 0).map((i) => (
                      <li key={i.key} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{i.label}</span>
                        <span className="font-semibold text-slate-950">{i.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{t("noOwned")}</p>
                )}
              </div>

              {/* Type-to-confirm */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {t("typeConfirmPre")}<span className="font-mono font-semibold text-slate-900">{deleteTarget.email}</span>{t("typeConfirmPost")}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={deleteTarget.email ?? ""}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#A32D2D] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={confirmEmail.trim().toLowerCase() !== (deleteTarget.email ?? "").toLowerCase()}
                onClick={() => void deleteUser(deleteTarget.id)}
                className="rounded-lg bg-[#A32D2D] px-3 py-2 text-sm font-semibold text-white hover:bg-[#8A2525] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("deletePermanently")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
