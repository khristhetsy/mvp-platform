"use client";

import { useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState, type QuickFilter } from "@/components/admin/OdooSearchBar";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";

/**
 * Admin, Billing, Paid signups. People who paid before they had a login.
 * Staff see who has not created a login yet and can send the private link again.
 * Requires manage_billing.
 */
export type PaidSignupRowView = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  plan_type: PlanType;
  status: "checkout_started" | "paid" | "claimed";
  paid_at: string | null;
  login_email_sent_at: string | null;
  claimed_at: string | null;
};

const navy = "#0A1A40";
const blue = "#1A6CE4";

const QUICK: QuickFilter[] = [
  { key: "paid", label: "Login not created" },
  { key: "claimed", label: "Login created" },
];

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC";
}

const SEARCH_FIELDS: SearchField<PaidSignupRowView>[] = [
  { label: "name", get: (r) => r.full_name },
  { label: "company", get: (r) => r.company },
  { label: "email", get: (r) => r.email },
  { label: "plan", get: (r) => PLAN_LABELS[r.plan_type] ?? r.plan_type },
];

export function PaidSignupsClient({ initialRows }: Readonly<{ initialRows: PaidSignupRowView[] }>) {
  const [rows, setRows] = useState<PaidSignupRowView[]>(initialRows);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const filtered = useMemo(() => (search.quick.length ? rows.filter((r) => search.quick.includes(r.status)) : rows), [rows, search.quick]);
  const searched = useMemo(() => ({ ...matchRows(filtered, SEARCH_FIELDS, search.q), total: rows.length }), [filtered, search.q, rows.length]);
  const visible = searched.rows;
  const query = search.q;

  async function resend(row: PaidSignupRowView) {
    setBusy(row.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/billing/paid-signups/${row.id}`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; sentAt?: string } | null;
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "bad", text: data?.error ?? "Could not send the link." });
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, login_email_sent_at: data.sentAt ?? new Date().toISOString() } : r)));
      setMessage({ tone: "good", text: `Login link sent to ${row.email}.` });
    } catch {
      setMessage({ tone: "bad", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, verticalAlign: "middle" };
  const btn: React.CSSProperties = { fontSize: 11.5, padding: "4px 9px", borderRadius: 7, border: "0.5px solid #E4E8F0", background: "#fff", color: navy, cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #EEF1F5" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: navy }}>Paid signups</div>
        <div style={{ fontSize: 12, color: "#6B7690", marginTop: 2 }}>People who paid before creating a login. If someone cannot get in, send their private link again.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #EEF1F5", flexWrap: "wrap" }}>
        <OdooSearchBar scope="admin-billing-paid-signups" state={search} onChange={setSearch} quick={QUICK} fields={[]} groups={[{ id: "none", label: "No grouping" }]} noGroupId="none" placeholder="Search paid signups" width={440} />
        <span style={{ marginLeft: "auto" }}>
          <SearchCount result={{ ...searched, active: searched.active || filtered.length !== rows.length }} noun="signups" />
        </span>
      </div>
      {message ? (
        <div style={{ padding: "8px 14px", fontSize: 12.5, background: message.tone === "bad" ? "#FCEBEB" : "#E1F5EE", color: message.tone === "bad" ? "#A32D2D" : "#0F6E56" }} role="status">
          {message.text}
        </div>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6B7690", background: "#F6F8FB" }}>
              <th style={{ ...cell, fontWeight: 500 }}>Name</th>
              <th style={{ ...cell, fontWeight: 500 }}>Company</th>
              <th style={{ ...cell, fontWeight: 500 }}>Plan</th>
              <th style={{ ...cell, fontWeight: 500 }}>Paid</th>
              <th style={{ ...cell, fontWeight: 500 }}>Login</th>
              <th style={{ ...cell, fontWeight: 500 }}>Link sent</th>
              <th style={{ ...cell, fontWeight: 500, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 12 }}>
                  {query.trim() ? (
                    <NoSearchMatches query={query} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
                  ) : (
                    <span style={{ fontSize: 12.5, color: "#6B7690" }}>{rows.length ? "No signups match these filters." : "No paid signups yet. They appear here when someone pays before creating a login."}</span>
                  )}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const waiting = r.status === "paid";
                return (
                  <tr key={r.id} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600, color: navy }}><Highlight text={r.full_name ?? r.email} query={query} /></div>
                      {r.full_name ? <div style={{ fontSize: 11, color: "#6B7690" }}><Highlight text={r.email} query={query} /></div> : null}
                    </td>
                    <td style={cell}><Highlight text={r.company ?? ""} query={query} /></td>
                    <td style={cell}><Highlight text={PLAN_LABELS[r.plan_type] ?? r.plan_type} query={query} /></td>
                    <td style={cell}>{when(r.paid_at)}</td>
                    <td style={cell}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 6, padding: "2px 8px", background: waiting ? "#FAEEDA" : "#E1F5EE", color: waiting ? "#854F0B" : "#0F6E56" }}>
                        {waiting ? "Not created" : "Created"}
                      </span>
                    </td>
                    <td style={cell}>{when(r.login_email_sent_at)}</td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      {waiting ? (
                        <button type="button" style={{ ...btn, background: blue, color: "#fff", border: "none", fontWeight: 600 }} disabled={busy !== null} onClick={() => void resend(r)}>
                          {busy === r.id ? "Sending..." : "Resend login link"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
