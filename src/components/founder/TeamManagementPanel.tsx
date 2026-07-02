"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

type Member = {
  id: string;
  role: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null; email: string; avatar_url: string | null } | null;
};

type Invite = {
  id: string;
  invitee_email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

const ACCENT = "#534AB7";

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    owner:  { bg: "#EEEDFE", color: ACCENT },
    admin:  { bg: "#ecfdf5", color: "#065f46" },
    member: { bg: "#f3f4f6", color: "#374151" },
  };
  const c = colors[role] ?? colors.member;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 9px",
      borderRadius: 20, background: c.bg, color: c.color,
      textTransform: "capitalize",
    }}>
      {role}
    </span>
  );
}

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const initials = (name ?? email).slice(0, 2).toUpperCase();
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name ?? email} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: "#EEEDFE", color: ACCENT,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function TeamManagementPanel({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations("founderCmp");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/founder/team");
      if (res.ok) {
        const data = await res.json() as { members: Member[]; invites: Invite[] };
        setMembers(data.members ?? []);
        setInvites(data.invites ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/founder/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json() as { error?: string | { _errors: string[] }; success?: boolean };
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Failed to send invite.";
        setError(msg);
      } else {
        setSuccess(`Invite sent to ${email.trim()}.`);
        setEmail("");
        void load();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleRemove(id: string, label: string) {
    if (!(await confirmDialog({ message: `Remove ${label}?`, danger: true, confirmLabel: "Remove" }))) return;
    const res = await fetch(`/api/founder/team/${id}`, { method: "DELETE" });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "Failed to remove.");
    } else {
      void load();
    }
  }

  return (
    <div>
      {/* Invite form */}
      <div style={{
        background: "#FAFBFF", border: `1px solid ${ACCENT}22`,
        borderRadius: 14, padding: "20px 22px", marginBottom: 28,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>
          Invite a team member
        </h3>
        <form onSubmit={(e) => { void handleInvite(e); }} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder={t("co_founder_example_com")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              flex: 1, minWidth: 200,
              fontSize: 14, padding: "9px 14px",
              border: "1px solid #d1d5db", borderRadius: 10,
              outline: "none", color: "#111827",
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            style={{
              fontSize: 13, fontWeight: 600, padding: "9px 12px",
              border: "1px solid #d1d5db", borderRadius: 10,
              background: "white", color: "#374151", cursor: "pointer",
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={sending}
            style={{
              background: ACCENT, color: "white",
              fontSize: 13, fontWeight: 600,
              padding: "9px 20px", borderRadius: 10,
              border: "none", cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </form>
        {error && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 10, fontWeight: 500 }}>{error}</p>}
        {success && <p style={{ fontSize: 13, color: "#16a34a", marginTop: 10, fontWeight: 500 }}>{success}</p>}
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
          They&apos;ll receive an email with a link to join. Invites expire in 7 days.
        </p>
      </div>

      {/* Members list */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 12px" }}>
          Current members
        </h3>
        {loading ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>{t("loading")}</p>
        ) : members.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>{t("no_members_yet")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map((m) => {
              const displayName = m.profiles?.full_name ?? m.profiles?.email ?? "Unknown";
              const isCurrentUser = m.user_id === currentUserId;
              const isOwner = m.role === "owner";
              return (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", background: "white",
                  border: "1px solid #e5e7eb", borderRadius: 12,
                }}>
                  <Avatar name={m.profiles?.full_name ?? null} email={m.profiles?.email ?? ""} avatarUrl={m.profiles?.avatar_url ?? null} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>
                      {displayName}
                      {isCurrentUser && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginLeft: 6 }}>(you)</span>}
                    </p>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{m.profiles?.email ?? ""}</p>
                  </div>
                  <RoleBadge role={m.role} />
                  {!isOwner && !isCurrentUser && (
                    <button
                      onClick={() => void handleRemove(m.id, displayName)}
                      style={{
                        fontSize: 12, color: "#6b7280", background: "none",
                        border: "1px solid #e5e7eb", borderRadius: 8,
                        padding: "5px 10px", cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 12px" }}>
            Pending invites
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map((inv) => (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", background: "#fffbeb",
                border: "1px solid #fcd34d", borderRadius: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#fef3c7", color: "#92400e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  ?
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{inv.invitee_email}</p>
                  <p style={{ fontSize: 12, color: "#92400e", margin: "2px 0 0" }}>
                    Invite pending · Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => void handleRemove(inv.id, inv.invitee_email)}
                  style={{
                    fontSize: 12, color: "#6b7280", background: "none",
                    border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "5px 10px", cursor: "pointer",
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
