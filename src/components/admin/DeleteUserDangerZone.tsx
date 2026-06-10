"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  userId: string;
  userName: string | null;
  userEmail: string | null;
};

export function DeleteUserDangerZone({ userId, userName, userEmail }: Readonly<Props>) {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/users/permissions/me")
      .then((r) => r.json())
      .then((data: { isSuperAdmin?: boolean }) => {
        if (data.isSuperAdmin) setIsSuperAdmin(true);
      })
      .catch(() => null);
  }, []);

  if (!isSuperAdmin) return null;

  const displayName = userName?.trim() || userEmail || userId;
  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
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
          <h3 className="text-sm font-semibold text-red-900">Danger zone</h3>
          <p className="mt-1 text-xs text-red-700">
            Permanently delete <span className="font-semibold">{displayName}</span>&apos;s account and all
            associated data. This action cannot be undone.
          </p>

          {!showConfirm ? (
            <button
              type="button"
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              onClick={() => setShowConfirm(true)}
            >
              Delete account
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-red-700">
                Type <span className="font-mono font-bold">DELETE</span> to confirm:
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
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Cancel
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
