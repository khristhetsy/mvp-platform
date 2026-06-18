"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { GoogleConnectionStatus } from "@/lib/integrations/connected-accounts";

export function GoogleCalendarConnectionCard({
  status,
  returnPath,
}: Readonly<{
  status: GoogleConnectionStatus;
  returnPath: "/founder/settings" | "/founder/settings/integrations" | "/investor/settings" | "/investor/settings?tab=integrations" | "/admin/tasks" | "/investor/tasks" | "/founder/tasks";
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flash = useMemo(() => {
    const google = searchParams.get("google");
    if (google === "connected") {
      return { type: "success" as const, message: "Google account connected successfully." };
    }
    if (google === "error") {
      const message = searchParams.get("message") ?? "Connection failed.";
      return { type: "error" as const, message };
    }
    return null;
  }, [searchParams]);

  async function disconnect() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/integrations/google/disconnect", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Unable to disconnect Google account.");
      return;
    }
    router.refresh();
  }

  if (!status.configured) {
    return (
      <div style={{
        background: "#ffffff",
        border: "0.5px solid #e2e6ed",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
        marginTop: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#0c2340" }}>Google Calendar</span>
        </div>
        <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#FAEEDA", color: "#854F0B", lineHeight: 1.6 }}>
          Google Calendar is not available yet. An administrator must configure Google OAuth environment variables.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#ffffff",
      border: "0.5px solid #e2e6ed",
      borderRadius: 12,
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
      marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#0c2340" }}>Google Calendar</span>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, margin: "0 0 14px" }}>
        Used for Google Calendar and Google Meet scheduling. When you accept a meeting, your connected
        account will host the calendar event.
      </p>

      {/* Flash message */}
      {flash && (
        <div style={{
          fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 12, lineHeight: 1.5,
          background: flash.type === "success" ? "#E1F5EE" : "#FCEBEB",
          color: flash.type === "success" ? "#0F6E56" : "#A32D2D",
        }}>
          {flash.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "#FCEBEB", color: "#A32D2D" }}>
          {error}
        </div>
      )}

      {/* Status badge + email */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 500,
          background: status.connected ? "#E1F5EE" : "#F1EFE8",
          color: status.connected ? "#0F6E56" : "#5F5E5A",
        }}>
          {status.connected ? "● Connected" : "● Not connected"}
        </span>
        {status.connected && status.email && (
          <span style={{ fontSize: 12, color: "#64748b" }}>{status.email}</span>
        )}
      </div>

      {status.connected && status.connectedAt && (
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 14px" }}>
          Connected {new Date(status.connectedAt).toLocaleString("en-US", { timeZone: "UTC" })}
        </p>
      )}

      {/* Action */}
      <div style={{ marginTop: 14 }}>
        {status.connected ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void disconnect()}
            style={{
              fontSize: 12, padding: "6px 14px", borderRadius: 8,
              border: "0.5px solid #e2e6ed", background: "transparent",
              color: "#0c2340", cursor: "pointer", opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a
            href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(returnPath)}`}
            style={{
              display: "inline-block", fontSize: 12, padding: "6px 14px", borderRadius: 8,
              border: "none", background: "#534AB7", color: "#EEEDFE", textDecoration: "none",
            }}
          >
            Connect Google account
          </a>
        )}
      </div>
    </div>
  );
}
