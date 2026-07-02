"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { adminWorkspaceNavSections } from "@/lib/workspace-nav";
import { FormField } from "@/components/ui/FormField";
import { useFormValidation } from "@/hooks/useFormValidation";

const changePasswordSchema = z
  .object({
    newPwd: z.string().min(8),
    confirmPwd: z.string().min(1),
  })
  .refine((data) => data.newPwd === data.confirmPwd, {
    message: "Passwords do not match.",
    path: ["confirmPwd"],
  });

const MODULE_ICONS: Record<string, { bg: string; color: string; icon: string }> = {
  Dashboard: { bg: "#dbeafe", color: "#1d4ed8", icon: "ti-layout-dashboard" },
  Actions: { bg: "#fef3c7", color: "#b45309", icon: "ti-bolt" },
  Companies: { bg: "#dbeafe", color: "#1d4ed8", icon: "ti-building" },
  SPVs: { bg: "#e0e7ff", color: "#4338ca", icon: "ti-building-bank" },
  Investors: { bg: "#ccfbf1", color: "#0f766e", icon: "ti-users" },
  "Deal Rooms": { bg: "#ede9fe", color: "#6d28d9", icon: "ti-door" },
  CRM: { bg: "#fef3c7", color: "#b45309", icon: "ti-address-book" },
  Matching: { bg: "#ffe4e6", color: "#be123c", icon: "ti-arrows-shuffle" },
  Learning: { bg: "#ccfbf1", color: "#0f766e", icon: "ti-book" },
  Billing: { bg: "#dbeafe", color: "#1d4ed8", icon: "ti-credit-card" },
  Diligence: { bg: "#fef3c7", color: "#b45309", icon: "ti-clipboard-check" },
  Compliance: { bg: "#ffe4e6", color: "#be123c", icon: "ti-shield-check" },
  Audit: { bg: "#ccfbf1", color: "#0f766e", icon: "ti-file-search" },
  Integrations: { bg: "#e0e7ff", color: "#4338ca", icon: "ti-plug" },
  Queues: { bg: "#ede9fe", color: "#6d28d9", icon: "ti-stack" },
  Automation: { bg: "#ccfbf1", color: "#0f766e", icon: "ti-rocket" },
  Reports: { bg: "#dbeafe", color: "#1d4ed8", icon: "ti-chart-bar" },
  "Import / Export": { bg: "#fef3c7", color: "#b45309", icon: "ti-database-import" },
  Analytics: { bg: "#ffe4e6", color: "#be123c", icon: "ti-chart-line" },
  Insights: { bg: "#e0e7ff", color: "#4338ca", icon: "ti-bulb" },
  "System Health": { bg: "#ccfbf1", color: "#0f766e", icon: "ti-heart-rate-monitor" },
  "Beta Operations": { bg: "#ede9fe", color: "#6d28d9", icon: "ti-flask" },
  "User Permissions": { bg: "#dbeafe", color: "#1d4ed8", icon: "ti-lock" },
  "Page Builder Lab": { bg: "#fef3c7", color: "#b45309", icon: "ti-layout" },
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "?")[0].toUpperCase();
}

type Props = {
  initialName: string | null;
  email: string | null;
  role: string;
  isSuperAdmin: boolean;
  createdAt: string;
};

export function AdminProfileClient({ initialName, email, role, isSuperAdmin, createdAt }: Readonly<Props>) {
  const t = useTranslations("adminCmp");
  const { getError, inputCls, validate, clearError } = useFormValidation();

  const [name, setName] = useState(initialName ?? "");
  const [editingName, setEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const PWD_INPUT = "w-full rounded-md border px-3 py-2 text-sm outline-none";

  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const initials = getInitials(name, email);
  const memberSince = new Date(createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const allModules = adminWorkspaceNavSections.flatMap((s) => s.items);

  async function saveName() {
    setNameSaving(true);
    setNameError(null);
    setNameSuccess(false);
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name }),
    });
    setNameSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setNameError(body?.error ?? "Could not update name.");
      return;
    }
    setNameSuccess(true);
    setEditingName(false);
  }

  async function changePassword() {
    setPwdError(null);
    setPwdSuccess(false);
    if (!validate(changePasswordSchema, { newPwd, confirmPwd })) return;
    setPwdSaving(true);
    const res = await fetch("/api/admin/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", password: newPwd }),
    });
    setPwdSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setPwdError(body?.error ?? "Could not change password.");
      return;
    }
    setPwdSuccess(true);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
  }

  async function sendResetEmail() {
    setResetSending(true);
    setResetError(null);
    setResetSent(false);
    const res = await fetch("/api/admin/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", email }),
    });
    setResetSending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setResetError(body?.error ?? "Could not send reset email.");
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* Left sidebar */}
      <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-panel)]">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#dbeafe] text-xl font-medium text-[#1d4ed8]">
          {initials}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-950">{name || email}</p>
          <p className="mt-1 text-xs text-slate-500">{email}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {isSuperAdmin ? (
              <span className="rounded-full border border-[#bfdbfe] bg-[#dbeafe] px-2.5 py-0.5 text-[10px] font-medium text-[#1d4ed8]">
                Super Admin
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 capitalize">
                {role}
              </span>
            )}
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
              Active
            </span>
          </div>
        </div>

        <div className="w-full border-t border-slate-100 pt-4">
          <dl className="space-y-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-slate-500">Member since</dt>
              <dd className="text-[11px] font-medium text-slate-900">{memberSince}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-slate-500">Modules</dt>
              <dd className="text-[11px] font-medium text-slate-900">{allModules.length} / {allModules.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[11px] text-slate-500">2FA</dt>
              <dd className="text-[11px] font-medium text-slate-500">Not configured</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Right content */}
      <div className="space-y-6">
        {/* Personal info */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-950">{t("personal_information")}</h2>
              <p className="text-[11px] text-slate-500">{t("your_name_and_account_details")}</p>
            </div>
            {!editingName && (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-xs font-medium text-[var(--blue)] hover:text-[var(--blue-hover)]"
              >
                Edit
              </button>
            )}
          </div>
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Full name
                </label>
                {editingName ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-[var(--blue)] focus:ring-1 focus:ring-[var(--blue)]"
                  />
                ) : (
                  <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                    {name || "—"}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Email address
                </label>
                <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {email}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Role
                </label>
                <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm capitalize text-slate-500">
                  {isSuperAdmin ? "Super Admin" : role}
                </p>
              </div>
            </div>

            {editingName && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={nameSaving}
                  onClick={() => void saveName()}
                  className="rounded-md bg-[#2563eb] px-4 py-2 text-xs font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-60"
                >
                  {nameSaving ? "Saving…" : "Save name"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setName(initialName ?? ""); }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
            {nameError && <p className="mt-3 text-xs text-red-600">{nameError}</p>}
            {nameSuccess && <p className="mt-3 text-xs text-emerald-600">{t("name_updated")}</p>}
          </div>
        </section>

        {/* Security */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-medium text-slate-950">{t("security")}</h2>
            <p className="text-[11px] text-slate-500">{t("password_management_and_account_security")}</p>
          </div>
          <div className="p-5">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Change password */}
              <div>
                <h3 className="mb-3 text-xs font-medium text-slate-700">{t("change_password")}</h3>
                <div className="space-y-3">
                  <FormField label={t("current_password")} hint="Required by Supabase to verify identity">
                    <input
                      type="password"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="••••••••"
                      className={`${PWD_INPUT} ${inputCls("currentPwd")}`}
                    />
                  </FormField>
                  <FormField label={t("new_password")} error={getError("newPwd")} hint="Min 8 characters">
                    <input
                      type="password"
                      value={newPwd}
                      onChange={(e) => { setNewPwd(e.target.value); clearError("newPwd"); }}
                      placeholder={t("min_8_characters")}
                      className={`${PWD_INPUT} ${inputCls("newPwd")}`}
                    />
                  </FormField>
                  <FormField label={t("confirm_new_password")} error={getError("confirmPwd")}>
                    <input
                      type="password"
                      value={confirmPwd}
                      onChange={(e) => { setConfirmPwd(e.target.value); clearError("confirmPwd"); }}
                      placeholder={t("repeat_new_password")}
                      className={`${PWD_INPUT} ${inputCls("confirmPwd")}`}
                    />
                  </FormField>
                  <button
                    type="button"
                    disabled={pwdSaving || !newPwd || !confirmPwd}
                    onClick={() => void changePassword()}
                    className="rounded-md bg-[#2563eb] px-4 py-2 text-xs font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-60"
                  >
                    {pwdSaving ? "Updating…" : "Update password"}
                  </button>
                  {pwdError ? <p className="text-xs text-red-600">{pwdError}</p> : null}
                  {pwdSuccess ? <p className="text-xs text-emerald-600">{t("password_updated_successfully")}</p> : null}
                </div>
              </div>

              {/* Reset & 2FA */}
              <div className="space-y-5">
                <div>
                  <h3 className="mb-1 text-xs font-medium text-slate-700">{t("reset_via_email")}</h3>
                  <p className="mb-3 text-[11px] text-slate-500">
                    Send a password reset link to {email}.
                  </p>
                  <button
                    type="button"
                    disabled={resetSending || resetSent}
                    onClick={() => void sendResetEmail()}
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {resetSending ? "Sending…" : resetSent ? "Reset email sent ✓" : "Send reset email"}
                  </button>
                  {resetError && <p className="mt-2 text-xs text-red-600">{resetError}</p>}
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-medium text-slate-700">{t("two_factor_authentication")}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Add an extra layer of security to your account.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] text-slate-500">
                      Not configured
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400"
                    title={t("coming_soon")}
                  >
                    Set up 2FA — coming soon
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Authorized modules */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-950">{t("authorized_modules")}</h2>
              <p className="text-[11px] text-slate-500">{t("platform_sections_you_can_access")}</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
              Super Admin only
            </span>
          </div>
          <div className="p-5">
            {adminWorkspaceNavSections.map((section, si) => (
              <div key={si} className={si > 0 ? "mt-5" : ""}>
                {section.title && (
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {section.title}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {section.items.map((item) => {
                    const style = MODULE_ICONS[item.label] ?? { bg: "#f1f5f9", color: "#475569", icon: "ti-grid-dots" };
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-2 rounded-md border border-[#bfdbfe] bg-[#f0f7ff] px-3 py-2"
                      >
                        <div
                          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded"
                          style={{ backgroundColor: style.bg, color: style.color }}
                        >
                          <i className={`ti ${style.icon}`} aria-hidden="true" style={{ fontSize: 11 }} />
                        </div>
                        <span className="truncate text-[11px] font-medium text-slate-900">{item.label}</span>
                        <i className="ti ti-circle-check ml-auto shrink-0 text-[#2563eb]" aria-hidden="true" style={{ fontSize: 13 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="mt-4 text-[10px] text-slate-400">
              Module authorization is managed by Super Admin in User Permissions.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
