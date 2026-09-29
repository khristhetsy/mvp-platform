"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { HandOverPicker, type HandOverItem, type HandOverCandidate } from "@/components/admin/HandOverPicker";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string | null;
};

export function DeleteUserDangerZone({ userId, userName, userEmail }: Readonly<Props>) {
  const t = useTranslations("usersAdmin.danger");
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handOver, setHandOver] = useState<{ items: HandOverItem[]; candidates: HandOverCandidate[] } | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  useEffect(() => {
    void fetch("/api/admin/users/permissions/me")
      .then((r) => r.json())
      .then((data: { isSuperAdmin?: boolean }) => {
        if (data.isSuperAdmin) setIsSuperAdmin(true);
      })
      .catch(() => null);
  }, []);

  // Load what must be handed over once the confirm step opens.
  useEffect(() => {
    if (!showConfirm) return;
    let active = true;
    void fetch(`/api/admin/users/dependents?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mustReassign?: HandOverItem[]; candidates?: HandOverCandidate[] } | null) => {
        if (active) setHandOver({ items: d?.mustReassign ?? [], candidates: d?.candidates ?? [] });
      })
      .catch(() => { if (active) setHandOver({ items: [], candidates: [] }); });
    return () => { active = false; };
  }, [showConfirm, userId]);

  if (!isSuperAdmin) return null;

  const displayName = userName?.trim() || userEmail || userId;
  const needsHandOver = Boolean(handOver?.items.length);
  const canConfirm = confirmText.trim().toUpperCase() === "DELETE" && handOver !== null && (!needsHandOver || Boolean(reassignTo));

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reassignTo: reassignTo || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      router.push("/admin/companies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">{t("title")}</h3>
          <p className="mt-1 text-xs text-red-700">
            {t("descPre")}<span className="font-semibold">{displayName}</span>{t("descPost")}
          </p>

          {!showConfirm ? (
            <button
              type="button"
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              onClick={() => setShowConfirm(true)}
            >
              {t("deleteAccount")}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              {handOver ? (
                <HandOverPicker items={handOver.items} candidates={handOver.candidates} value={reassignTo} onChange={setReassignTo} />
              ) : null}
              <p className="text-xs text-red-700">
                {t("typePre")}<span className="font-mono font-bold">DELETE</span>{t("typePost")}
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canConfirm || deleting}
                  onClick={() => void handleDelete()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? t("deleting") : t("confirmDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setConfirmText(""); setReassignTo(""); setHandOver(null); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {t("cancel")}
                </button>
              </div>
              {error ? <p className="text-xs text-red-700">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
