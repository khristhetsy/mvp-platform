"use client";

/**
 * Step 4 additions: profile fill and the free person search.
 *   1. Load files: the AI research file (bios, company summaries, labelled guesses) and
 *      your own Drive exports (emails and phones), matched to contacts by LinkedIn profile.
 *   2. Person search: "person, then company" on each firm's own website. Free.
 *   3. Review: everything lands as proposals; nothing saves until accepted.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BLUE = "#2E78F5";
type Stats = { pendingContacts: number; pendingProposals: number; accepted: number };
type LoadResult = { rows: number; matched: number; unmatched: number; proposals: number; companies: number; alreadyThere: number };
type PersonRow = { contactId: string; name: string | null; company: string | null; website: string | null; email: string | null; phone: string | null; phoneKind: "direct" | "office" | null; result: string };

const RESULT: Record<string, { text: string; bg: string; fg: string }> = {
  found: { text: "Found", bg: "#EAF3DE", fg: "#27500A" },
  office_only: { text: "Office line only", bg: "#E6F1FB", fg: "#0C447C" },
  not_listed: { text: "Not listed on site", bg: "#F1EFE8", fg: "#444441" },
  no_website: { text: "No website known", bg: "#F1EFE8", fg: "#444441" },
  no_name: { text: "No full name", bg: "#F1EFE8", fg: "#444441" },
};

function Btn({ children, primary, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...p} style={{ fontSize: 12.5, fontWeight: primary ? 600 : 400, color: primary ? "#fff" : "var(--foreground)", background: primary ? BLUE : "#fff", border: primary ? "none" : "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 14px", cursor: p.disabled ? "default" : "pointer", opacity: p.disabled ? 0.55 : 1, ...p.style }}>{children}</button>;
}
const n = (v: number) => v.toLocaleString("en-US");
const card: React.CSSProperties = { border: "0.5px solid #e3e8f0", borderRadius: 12, padding: 14, background: "#fff", marginTop: 14 };

export function LinkedinFillPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [person, setPerson] = useState<{ pending: number; searched: number } | null>(null);
  const [group, setGroup] = useState<"investor" | "all">("investor");
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRef = useRef(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/sales/contacts/profile-fill?group=all", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive && j.stats) setStats(j.stats); }).catch(() => undefined);
    fetch(`/api/sales/contacts/person-search?group=${group}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive && typeof j.pending === "number") setPerson(j); }).catch(() => undefined);
    return () => { alive = false; };
  }, [group, refresh]);

  async function loadFile(kind: "research" | "found", file: File | null) {
    if (!file) return;
    setBusy(kind); setLoadMsg(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/sales/contacts/profile-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "load", kind, text }) });
      const j = (await res.json()) as LoadResult & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not load the file.");
      setLoadMsg(`${file.name}: ${n(j.rows)} rows, ${n(j.matched)} matched to contacts by LinkedIn profile${j.unmatched ? `, ${n(j.unmatched)} not in Contacts yet (run the import, then load again)` : ""}. ${n(j.proposals)} proposals added${j.alreadyThere ? `, ${n(j.alreadyThere)} skipped because the contact already has that value` : ""}${kind === "research" ? `, ${n(j.companies)} company summaries` : ""}.`);
      setRefresh((x) => x + 1);
    } catch (e) {
      setLoadMsg(e instanceof Error ? e.message : "Could not load the file.");
    } finally {
      setBusy(null);
    }
  }

  async function runSearch(all: boolean) {
    setRunning(true); setStopping(false); stopRef.current = false; setRows([]);
    let keepGoing = true;
    while (keepGoing) {
      try {
        const res = await fetch("/api/sales/contacts/person-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group, limit: 30 }) });
        const j = await res.json();
        if (!res.ok) { setLoadMsg(j.error ?? "Search failed."); break; }
        setRows((r) => [...(j.rows as PersonRow[]), ...r].slice(0, 500));
        keepGoing = all && j.contacts > 0;
      } catch { break; }
      if (stopRef.current) break;
    }
    setRunning(false);
    setRefresh((x) => x + 1);
  }

  const found = rows.filter((r) => r.result === "found").length;

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Profile fill</div>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {stats ? `${n(stats.pendingContacts)} contacts with ${n(stats.pendingProposals)} proposals waiting · ${n(stats.accepted)} accepted` : "Loading…"}
          </span>
          <Link href="/admin/sales/contacts/profile-fill" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "#fff", background: BLUE, borderRadius: 8, padding: "7px 14px", textDecoration: "none" }}>Review proposals</Link>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "8px 0 10px" }}>
          Bios, company summaries and profile fields drafted from the LinkedIn export and each firm&apos;s published pages. Every value is labelled LinkedIn, Found (with the source) or Guess (with the reason). Nothing saves until you accept it.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12.5, border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 12px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy === "research" ? "Loading…" : "Load research file (bios, summaries, guesses)"}
            <input type="file" accept=".csv,text/csv" hidden disabled={Boolean(busy)} onChange={(e) => { void loadFile("research", e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
          <label style={{ fontSize: 12.5, border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "7px 12px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy === "found" ? "Loading…" : "Load found emails and phones (your exports)"}
            <input type="file" accept=".csv,text/csv" hidden disabled={Boolean(busy)} onChange={(e) => { void loadFile("found", e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        </div>
        {loadMsg ? <p style={{ fontSize: 12.5, margin: "10px 0 0", color: "var(--foreground)" }}>{loadMsg}</p> : null}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Search by: person, then company</div>
          <select value={group} disabled={running} onChange={(e) => setGroup(e.target.value as "investor" | "all")} style={{ fontSize: 12.5, border: "0.5px solid #cdd9ec", borderRadius: 8, padding: "5px 8px" }}>
            <option value="investor">Investors first</option>
            <option value="all">All LinkedIn contacts</option>
          </select>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{person ? `${n(person.pending)} still missing an email or phone · ${n(person.searched)} searched` : ""}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {running ? <Btn disabled={stopping} onClick={() => { stopRef.current = true; setStopping(true); }}>{stopping ? "Stopping…" : "Stop after this batch"}</Btn> : null}
            <Btn disabled={running} onClick={() => runSearch(false)}>Run 30</Btn>
            <Btn primary disabled={running} onClick={() => runSearch(true)}>{running ? "Searching…" : "Run all"}</Btn>
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "8px 0 10px" }}>
          Free: reads each firm&apos;s own team, people and about pages for the person&apos;s name. Takes only what is published next to it: an email that carries their name, and a direct line printed with it, or else the firm&apos;s main number marked as an office line. No search engine, no people search sites, no guessed email formats. Contacts with no known website are skipped. Results go to Review proposals.
        </p>
        {rows.length ? (
          <>
            <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>{n(rows.length)} searched this run · {n(found)} with a published email or direct line</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 720 }}>
                <thead><tr>{["Name", "Company", "Website", "Email", "Phone", "Result"].map((h) => <th key={h} style={{ textAlign: "left", fontWeight: 500, fontSize: 11.5, color: "var(--muted-foreground)", padding: "7px 8px", borderBottom: "0.5px solid #e3e8f0" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 200).map((r) => (
                    <tr key={r.contactId}>
                      {[r.name, r.company, r.website?.replace(/^https?:\/\//, ""), r.email, r.phone ? `${r.phone}${r.phoneKind === "office" ? " (office)" : r.phoneKind === "direct" ? " (direct)" : ""}` : null].map((v, i) => (
                        <td key={i} style={{ fontSize: 12.5, padding: "7px 8px", borderBottom: "0.5px solid #eef1f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v ?? ""}</td>
                      ))}
                      <td style={{ fontSize: 12.5, padding: "7px 8px", borderBottom: "0.5px solid #eef1f5" }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: RESULT[r.result]?.bg, color: RESULT[r.result]?.fg }}>{RESULT[r.result]?.text ?? r.result}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
