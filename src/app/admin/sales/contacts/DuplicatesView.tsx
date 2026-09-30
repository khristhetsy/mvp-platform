"use client";

/**
 * Contacts → gear → Find duplicates. Contacts that share one email address, grouped under the
 * usual collapsible headers, largest groups first. Every member is ticked by default; untick one to
 * leave it out, then Merge opens the Merge dialog for that group.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import type { DuplicateGroup } from "@/lib/sales/merge-contacts-shared";
import { MergeContactsDialog, type MergeDone } from "./MergeContactsDialog";

const PAGE = 25;
const TYPE_BADGE: Record<string, { t: string; c: string; bg: string }> = {
  founder: { t: "Founder", c: "#712B13", bg: "#FAECE7" },
  investor: { t: "Investor", c: "#0C447C", bg: "#E6F1FB" },
  advisor: { t: "Advisor", c: "#633806", bg: "#FAEEDA" },
  other: { t: "Other", c: "#444441", bg: "#F1EFE8" },
};
const SEARCHED = ["email", "name", "company"];
const COLS = "36px 1.5fr 1.3fr 88px 1fr 1fr 104px";

export function DuplicatesView({ basePath, onExit, onChanged, onMerged }: { basePath: string; onExit: () => void; onChanged: () => void; onMerged: (done: MergeDone) => void }) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ groups: DuplicateGroup[]; totalGroups: number; totalExtra: number } | null>(null);
  const [allTotal, setAllTotal] = useState<{ groups: number; extra: number } | null>(null);
  const [left, setLeft] = useState<Set<string>>(new Set());   // members unticked (left out of the merge)
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string[] | null>(null);
  const [nonce, setNonce] = useState(0);
  // Which request the shown state answers; loading = the current request hasn't answered yet.
  const key = `${q}\n${offset}\n${nonce}`;
  const [answered, setAnswered] = useState<{ key: string; err: string | null } | null>(null);
  const loading = answered?.key !== key;
  const err = answered?.key === key ? answered.err : null;
  const reload = () => setNonce((n) => n + 1);

  // Filter as you type.
  useEffect(() => { const t = setTimeout(() => { setQ(typed.trim()); setOffset(0); }, 300); return () => clearTimeout(t); }, [typed]);

  useEffect(() => {
    let live = true;
    const [qq, off] = key.split("\n");
    fetch(`/api/sales/contacts/duplicates?q=${encodeURIComponent(qq)}&offset=${off}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Couldn't load duplicates."); return d; })
      .then((d) => {
        if (!live) return;
        setData(d);
        if (!qq) setAllTotal({ groups: d.totalGroups, extra: d.totalExtra });
        setAnswered({ key, err: null });
      })
      .catch((e) => { if (live) setAnswered({ key, err: e instanceof Error ? e.message : "Couldn't load duplicates." }); });
    return () => { live = false; };
  }, [key]);

  function toggleMember(id: string) { setLeft((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleGroup(email: string) { setClosed((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; }); }

  const groups = data?.groups ?? [];
  const total = data?.totalGroups ?? 0;
  const countText = q
    ? `${total.toLocaleString()} of ${(allTotal?.groups ?? total).toLocaleString()} duplicate groups`
    : `${total.toLocaleString()} duplicate groups · ${(data?.totalExtra ?? 0).toLocaleString()} extra records`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0C447C", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 16, padding: "5px 6px 5px 11px" }}>
          <i className="ti ti-copy" aria-hidden="true" /> Duplicates: same email
          <button type="button" onClick={onExit} aria-label="Leave duplicates view" style={{ width: 18, height: 18, border: "none", background: "#B5D4F4", color: "#0C447C", borderRadius: "50%", fontSize: 11, lineHeight: 1, cursor: "pointer" }}>×</button>
        </span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search email, name, or company" aria-label="Search duplicates" style={{ flex: 1, minWidth: 220, fontSize: 12.5, padding: "8px 11px", borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: "var(--background)", color: "var(--foreground)" }} />
        <span aria-live="polite" style={{ fontSize: 12, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{data ? countText : loading ? "Loading…" : ""}</span>
      </div>

      {err && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#FCEBEB", border: "0.5px solid #F4B5B5", borderRadius: 10, color: "#A32D2D", fontSize: 12.5, marginBottom: 12 }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" /><span style={{ flex: 1 }}>{err}</span>
          <button type="button" onClick={reload} style={{ fontSize: 11.5, fontWeight: 600, color: "#A32D2D", background: "#fff", border: "0.5px solid #F4B5B5", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {data && groups.length === 0 && q ? (
        <NoSearchMatches query={q} fields={SEARCHED} onClear={() => setTyped("")} />
      ) : data && groups.length === 0 ? (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No two contacts share an email address.</div>
      ) : (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, opacity: loading && data ? 0.6 : 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "9px 14px", background: "var(--muted)", fontSize: 10.5, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            <span /><span>Name</span><span>Company</span><span>Type</span><span>Source</span><span>Investor profile</span><span>Created on</span>
          </div>
          {groups.map((g) => {
            const open = !closed.has(g.email);
            const ticked = g.members.filter((m) => !left.has(m.id));
            return (
              <div key={g.email}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#E6F1FB", borderTop: "0.5px solid #e2e6ed" }}>
                  <button type="button" onClick={() => toggleGroup(g.email)} aria-expanded={open} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0, flex: 1, textAlign: "left" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0C447C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms" }}><polyline points="9 6 15 12 9 18" /></svg>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0C447C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={g.email} query={q} /></span>
                    <span style={{ fontSize: 11, color: "#185FA5", background: "#B5D4F4", borderRadius: 10, padding: "1px 8px" }}>{g.count} records</span>
                  </button>
                  <button type="button" onClick={() => setMerging(ticked.map((m) => m.id))} disabled={ticked.length < 2}
                    title={ticked.length < 2 ? "Tick at least two records to merge" : undefined}
                    style={{ fontSize: 11.5, fontWeight: 600, color: ticked.length < 2 ? "#9aa4b2" : "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "4px 11px", cursor: ticked.length < 2 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i className="ti ti-git-merge" aria-hidden="true" /> Merge {ticked.length}
                  </button>
                </div>
                {open && g.members.map((m) => {
                  const badge = TYPE_BADGE[m.type] ?? TYPE_BADGE.other;
                  return (
                    <div key={m.id} style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "center", fontSize: 12.5, borderTop: "0.5px solid #eef1f5", background: left.has(m.id) ? undefined : "#F5F9FF" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input type="checkbox" checked={!left.has(m.id)} onChange={() => toggleMember(m.id)} aria-label={`Include ${m.name ?? m.email} in the merge`} style={{ width: 14, height: 14, cursor: "pointer" }} />
                      </div>
                      <Link href={`${basePath}/${m.id}`} style={{ display: "contents", color: "var(--foreground)", textDecoration: "none" }}>
                        <span style={{ padding: "9px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}><Highlight text={m.name || m.email} query={q} /></span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: m.company ? undefined : "var(--muted-foreground)" }}>{m.company ? <Highlight text={m.company} query={q} /> : "—"}</span>
                        <span><span style={{ fontSize: 10.5, fontWeight: 500, color: badge.c, background: badge.bg, borderRadius: 6, padding: "2px 7px" }}>{badge.t}</span></span>
                        <span style={{ color: "var(--muted-foreground)" }}>{m.source === "odoo" ? "Odoo" : m.source || "—"}</span>
                        <span style={{ color: m.profileFields ? undefined : "var(--muted-foreground)" }}>{m.profileFields ? `${m.profileFields} field${m.profileFields === 1 ? "" : "s"} filled` : "Empty"}</span>
                        <span style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>{m.createdOn ? m.createdOn.slice(0, 10) : "—"}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {total > PAGE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "8px 14px", background: "#F8FAFD", borderTop: "0.5px solid #eef1f5", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{(offset + 1).toLocaleString()}–{Math.min(total, offset + groups.length).toLocaleString()} / {total.toLocaleString()} groups</span>
              <button type="button" onClick={() => setOffset((o) => Math.max(0, o - PAGE))} disabled={loading || offset === 0} style={{ fontSize: 11, color: offset === 0 ? "#9aa4b2" : "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "4px 10px", cursor: offset === 0 ? "not-allowed" : "pointer" }}><i className="ti ti-chevron-left" aria-hidden="true" /> Prev</button>
              <button type="button" onClick={() => setOffset((o) => o + PAGE)} disabled={loading || offset + PAGE >= total} style={{ fontSize: 11, color: offset + PAGE >= total ? "#9aa4b2" : "#185FA5", background: "#fff", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "4px 10px", cursor: offset + PAGE >= total ? "not-allowed" : "pointer" }}>Next <i className="ti ti-chevron-right" aria-hidden="true" /></button>
            </div>
          )}
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "10px 2px 0" }}>
        Contacts that share one email address (placeholder text such as &ldquo;email undeliverable&rdquo; doesn&rsquo;t count). Untick a record to leave it out, then Merge to choose which record and values to keep.
      </p>

      {merging && (
        <MergeContactsDialog ids={merging} onClose={() => setMerging(null)}
          onMerged={(done) => { setMerging(null); onMerged(done); onChanged(); reload(); }} />
      )}
    </div>
  );
}
