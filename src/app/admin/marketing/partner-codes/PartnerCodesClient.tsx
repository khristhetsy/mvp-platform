"use client";

import { useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { NewButton, ToolbarGear, downloadCsv, type GearItem } from "@/components/admin/ToolbarGear";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import type { PartnerCodeRow } from "@/lib/listing/deal-notice-admin";

const PT = "America/Los_Angeles";
const APP_URL = "https://icapos.com";

function ptDate(iso: string): string {
  return `${new Date(iso).toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric", year: "numeric" })} PT`;
}

/** Same link as partnerSignUpLink on the server (that module is server only). */
function partnerLink(code: string): string {
  return `${APP_URL}/auth/sign-up?role=founder&plan=founder_free&ref=${encodeURIComponent(code)}`;
}

const FIELDS: SearchField<PartnerCodeRow>[] = [
  { label: "partner", get: (r) => r.partnerName },
  { label: "code", get: (r) => r.code },
  { label: "status", get: (r) => (r.isActive ? "active" : "inactive") },
  { label: "created", get: (r) => ptDate(r.createdAt) },
  { label: "claims", get: (r) => r.claims },
  { label: "complete", get: (r) => r.complete },
  { label: "partner link", get: (r) => partnerLink(r.code) },
];

const input: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12.5, borderRadius: 7, border: "0.5px solid var(--border-strong, #cbd5e1)", background: "#fff", color: "var(--foreground)",
};

export function PartnerCodesClient({ initial, loadError }: Readonly<{ initial: PartnerCodeRow[]; loadError: string | null }>) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [showNew, setShowNew] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const quick = search.quick;
  const preFiltered = rows.filter((r) => (!quick.includes("active") || r.isActive) && (!quick.includes("inactive") || !r.isActive));
  const result = matchRows(preFiltered, FIELDS, search.q);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!partnerName.trim()) return setFormError("Partner name is required.");
    if (!/^[A-Z0-9]{3,20}$/.test(normalized)) return setFormError("Code must be 3 to 20 letters or digits.");
    if (rows.some((r) => r.code === normalized)) return setFormError(`The code ${normalized} is already used.`);
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/marketing/partner-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName, code: normalized }),
      });
      const payload = (await res.json().catch(() => ({}))) as { codes?: PartnerCodeRow[]; error?: string };
      if (!res.ok || !payload.codes) throw new Error(payload.error ?? "Could not create the code.");
      setRows(payload.codes);
      setPartnerName("");
      setCode("");
      setShowNew(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the code.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: PartnerCodeRow) {
    setBusyId(r.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketing/partner-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Update failed.");
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function copy(r: PartnerCodeRow) {
    try {
      await navigator.clipboard.writeText(partnerLink(r.code));
      setCopied(r.id);
      setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1800);
    } catch {
      setError("Could not copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <NewButton onClick={() => { setShowNew((v) => !v); setFormError(null); }} />
        <ToolbarGear heading="Partner codes" items={[
          {
            key: "export", icon: "ti-download", label: "Export all", hint: `${result.rows.length} matching`,
            onClick: () => downloadCsv(
              `partner-codes-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Partner", "Code", "Active", "Created (PT)", "Claims", "Complete", "Partner link"],
              result.rows.map((r) => [r.partnerName, r.code, r.isActive ? "yes" : "no", ptDate(r.createdAt), r.claims, r.complete, partnerLink(r.code)]),
            ),
          } as GearItem,
        ]} />
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>Partner codes</h1>
          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Attribute free founder signups to referral partners</div>
        </div>
        <OdooSearchBar scope="marketing_partner_codes" state={search} onChange={setSearch}
          quick={[
            { key: "active", label: "Active" },
            { key: "inactive", label: "Inactive" },
          ]}
          fields={[]} groups={[{ id: "none", label: "None" }]} noGroupId="none"
          placeholder="Search partner or code…" width={400} />
      </div>

      {showNew ? (
        <form onSubmit={create} style={{ border: "0.5px solid var(--border)", borderRadius: 10, background: "#fff", padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--muted-foreground)" }}>
            Partner name
            <input style={{ ...input, width: 240 }} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="AI X Network" required maxLength={120} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--muted-foreground)" }}>
            Code (3 to 20 letters or digits)
            <input style={{ ...input, width: 180, textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)" }} value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20))} placeholder="AIX" required />
          </label>
          <button type="submit" disabled={saving} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#1A6CE4", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Create code"}
          </button>
          <button type="button" onClick={() => setShowNew(false)} style={{ fontSize: 12.5, background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer" }}>Cancel</button>
          {formError ? <p style={{ width: "100%", margin: 0, fontSize: 12, color: "#A32D2D" }}>{formError}</p> : null}
        </form>
      ) : null}

      {error ? <p style={{ fontSize: 12, color: "#A32D2D", margin: 0 }}>{error}</p> : null}

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "48px 0" }}>
          No partner codes yet. Use New to add one, then share its partner link.
        </div>
      ) : (
        <>
          <SearchCount result={result} noun="codes" />
          {result.rows.length === 0 && result.active ? (
            <NoSearchMatches query={search.q} fields={FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
          ) : result.rows.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, padding: "32px 0" }}>No codes in this view.</div>
          ) : (
            <div style={{ overflowX: "auto", border: "0.5px solid var(--border)", borderRadius: 10, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--muted)", color: "var(--muted-foreground)", textAlign: "left" }}>
                    {["Partner", "Code", "Active", "Created", "Claims", "Complete", "Partner link"].map((h, i) => (
                      <th key={h} style={{ padding: "8px 12px", fontWeight: 600, fontSize: 11, textAlign: i === 4 || i === 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 500 }}><Highlight text={r.partnerName} query={search.q} /></td>
                      <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono, monospace)" }}><Highlight text={r.code} query={search.q} /></td>
                      <td style={{ padding: "9px 12px" }}>
                        <button type="button" role="switch" aria-checked={r.isActive} aria-label={`${r.isActive ? "Turn off" : "Turn on"} ${r.code}`}
                          disabled={busyId === r.id} onClick={() => toggle(r)}
                          style={{ width: 34, height: 19, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: r.isActive ? "#1A6CE4" : "#cbd5e1", opacity: busyId === r.id ? 0.6 : 1 }}>
                          <span style={{ position: "absolute", top: 2, left: r.isActive ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                        </button>
                      </td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}><Highlight text={ptDate(r.createdAt)} query={search.q} /></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.claims}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.complete}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <code style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }} title={partnerLink(r.code)}>
                            {partnerLink(r.code).replace("https://", "")}
                          </code>
                          <button type="button" onClick={() => copy(r)}
                            style={{ fontSize: 11.5, fontWeight: 600, border: "0.5px solid var(--border-strong, #cbd5e1)", background: "#fff", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: copied === r.id ? "#3B6D11" : "var(--foreground)" }}>
                            {copied === r.id ? "Copied" : "Copy"}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
            Claims: free report claims recorded with the code (lead_claims). Complete: companies with the code whose listing checklist is complete. Turning a code off stops new attribution; past attribution stays.
          </p>
        </>
      )}
    </div>
  );
}
