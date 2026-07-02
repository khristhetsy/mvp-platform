"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssembledPlaybook, PlaybookCard, PlaybookBlock } from "@/lib/playbook/types";
import { BLOCK_LABEL } from "@/lib/playbook/types";
import { ModuleCard } from "./ModuleCard";
import { DriftBanner } from "./DriftBanner";
import { EditModule } from "./EditModule";

const NAVY = "#0f2147";
const BLOCK_ORDER: PlaybookBlock[] = ["open", "core", "close"];

export interface ConsoleEndpoints {
  get: string;
  counts: string | null;
  patch: string;
}

const ADMIN_ENDPOINTS: ConsoleEndpoints = {
  get: "/api/admin/playbook",
  counts: "/api/admin/playbook/counts",
  patch: "/api/admin/playbook/module",
};

export function PlaybookConsole({ initial, isAdmin, endpoints = ADMIN_ENDPOINTS }: { initial: AssembledPlaybook; isAdmin: boolean; endpoints?: ConsoleEndpoints }) {
  const [data, setData] = useState<AssembledPlaybook>(initial);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<PlaybookCard | null>(null);

  const loadCounts = useCallback(async () => {
    if (!endpoints.counts) return;
    try {
      const res = await fetch(endpoints.counts);
      if (res.ok) setCounts((await res.json()).counts ?? {});
    } catch { /* counts are best-effort */ }
  }, [endpoints.counts]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoints.get);
      if (res.ok) setData(await res.json());
    } catch { /* keep current */ }
    void loadCounts();
  }, [endpoints.get, loadCounts]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadCounts(); }, [loadCounts]);

  const { documented, undocumented } = useMemo(() => {
    const doc: Record<PlaybookBlock, PlaybookCard[]> = { open: [], core: [], close: [] };
    const und: PlaybookCard[] = [];
    for (const card of data.cards) {
      if (card.state === "undocumented") und.push(card);
      else if (card.content) doc[card.content.block].push(card);
    }
    for (const b of BLOCK_ORDER) doc[b].sort((a, z) => (a.content!.sortOrder - z.content!.sortOrder));
    return { documented: doc, undocumented: und };
  }, [data]);

  const undocCount = undocumented.length;
  const noStepsCount = data.cards.filter((c) => c.state === "no_steps").length;

  const countFor = (card: PlaybookCard) => (card.content?.countSource ? counts[card.content.countSource] : undefined);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
      {/* Sticky jump-nav spine */}
      <nav style={{ position: "sticky", top: 12, display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}>
        {BLOCK_ORDER.map((b) => documented[b].length ? (
          <div key={b}>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#534AB7", margin: "0 0 6px" }}>{BLOCK_LABEL[b]}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, borderLeft: "2px solid #E4E1F6", paddingLeft: 10 }}>
              {documented[b].map((card) => (
                <a key={card.navId} href={`#pb-${card.navId}`} style={{ color: "#3d3d3a", textDecoration: "none" }}>{card.label}</a>
              ))}
            </div>
          </div>
        ) : null)}
        {undocCount ? (
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#854F0B", margin: "0 0 6px" }}>New surfaces</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, borderLeft: "2px solid #EDD8AE", paddingLeft: 10 }}>
              {undocumented.map((card) => <a key={card.navId} href={`#pb-${card.navId}`} style={{ color: "#7a5b12", textDecoration: "none" }}>{card.label}</a>)}
            </div>
          </div>
        ) : null}
      </nav>

      {/* The spine of cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <DriftBanner undocumented={undocCount} noSteps={noStepsCount} orphaned={data.orphaned} />

        {BLOCK_ORDER.map((b) => documented[b].length ? (
          <section key={b} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: NAVY, textTransform: "uppercase", letterSpacing: ".06em", margin: 0 }}>{BLOCK_LABEL[b]}</h2>
            {documented[b].map((card) => (
              <ModuleCard key={card.navId} card={card} count={countFor(card)} isAdmin={isAdmin} onEdit={() => setEditing(card)} />
            ))}
          </section>
        ) : null)}

        {undocCount ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#854F0B", textTransform: "uppercase", letterSpacing: ".06em", margin: 0 }}>New surfaces — undocumented</h2>
            {undocumented.map((card) => (
              <ModuleCard key={card.navId} card={card} isAdmin={isAdmin} onEdit={() => setEditing(card)} />
            ))}
          </section>
        ) : null}

        {data.orphaned.length ? (
          <section style={{ background: "#FDF2F2", border: "0.5px solid #F3C0C0", borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#A32D2D", margin: "0 0 8px" }}>Needs cleanup — orphaned entries</h2>
            <p style={{ fontSize: 12, color: "#7a2323", margin: "0 0 10px" }}>These editorial entries reference a surface that is no longer in the menu. Remove or re-point them.</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#7a2323" }}>
              {data.orphaned.map((o) => <li key={o.navId}><code>{o.navId}</code> — {o.steps} step(s), block “{o.block}”.</li>)}
            </ul>
          </section>
        ) : null}

        <p style={{ fontSize: 11, color: "#9aa3b0", margin: 0 }}>Generated {new Date(data.generatedAt).toLocaleString()} · reads the live admin menu, so it can’t drift.</p>
      </div>

      {editing ? <EditModule card={editing} patchUrl={endpoints.patch} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} /> : null}
    </div>
  );
}
