"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/founder/search/route";

// ── Static page shortcuts ─────────────────────────────────────────────────────

type PageShortcut = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
};

const PAGES: PageShortcut[] = [
  { id: "dashboard",   title: "Dashboard",            subtitle: "Founder terminal", href: "/founder",                          keywords: ["home", "overview", "dashboard"] },
  { id: "readiness",   title: "Readiness checklist",  subtitle: "Score & documents", href: "/founder/readiness",              keywords: ["readiness", "score", "checklist", "documents"] },
  { id: "documents",   title: "Documents",            subtitle: "Upload & manage files", href: "/founder/documents",           keywords: ["docs", "upload", "files", "pitch deck"] },
  { id: "crm",         title: "Investor CRM",         subtitle: "Outreach & contacts", href: "/founder/investors/outreach",    keywords: ["crm", "contacts", "outreach", "investors"] },
  { id: "pipeline",    title: "Investor pipeline",    subtitle: "Track your funnel", href: "/founder/investor-pipeline",       keywords: ["pipeline", "funnel", "investors"] },
  { id: "matching",    title: "Investor matching",    subtitle: "Platform matches", href: "/founder/investors/matches",        keywords: ["matches", "matching", "recommended"] },
  { id: "deal-rooms",  title: "Deal rooms",           subtitle: "Data room access", href: "/founder/deal-room",               keywords: ["deal", "room", "data room"] },
  { id: "capital",     title: "Capital raise",        subtitle: "Fundraising overview", href: "/founder/capital-raise",       keywords: ["capital", "raise", "fundraising"] },
  { id: "raise-cmd",   title: "Raise command center", subtitle: "AI tools", href: "/founder/raise-command-center",           keywords: ["command", "center", "tools"] },
  { id: "raise-kit",   title: "Raise toolkit",        subtitle: "Templates & guides", href: "/founder/raise-toolkit",         keywords: ["toolkit", "templates"] },
  { id: "analytics",   title: "Analytics",            subtitle: "Insights & trends", href: "/founder/analytics",              keywords: ["analytics", "insights", "metrics"] },
  { id: "learning",    title: "Learning",             subtitle: "Capital modules", href: "/founder/learning",                 keywords: ["learning", "courses", "education"] },
  { id: "settings",    title: "Company settings",     subtitle: "Profile & branding", href: "/founder/settings",              keywords: ["settings", "profile", "company"] },
  { id: "actions",     title: "Action center",        subtitle: "Tasks & priorities", href: "/founder/actions",               keywords: ["actions", "tasks", "priorities"] },
];

// ── Type icons ────────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: SearchResult["type"] | "page" }) {
  const ACCENT = "#534AB7";
  if (type === "contact") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke={ACCENT} strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === "document") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={ACCENT} strokeWidth="2" />
      <polyline points="14 2 14 8 20 8" stroke={ACCENT} strokeWidth="2" />
      <line x1="8" y1="13" x2="16" y2="13" stroke={ACCENT} strokeWidth="2" />
      <line x1="8" y1="17" x2="12" y2="17" stroke={ACCENT} strokeWidth="2" />
    </svg>
  );
  if (type === "deal_room") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke={ACCENT} strokeWidth="2" />
      <path d="M8 21h8M12 17v4" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  // page
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="#6b7280" strokeWidth="2" />
      <polyline points="9 22 9 12 15 12 15 22" stroke="#6b7280" strokeWidth="2" />
    </svg>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicResults, setDynamicResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open on cmd+K / ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setDynamicResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced API search
  const fetchDynamic = useCallback(async (q: string) => {
    if (q.length < 2) { setDynamicResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/founder/search?q=${encodeURIComponent(q)}`);
      const json = await res.json() as { results: SearchResult[] };
      setDynamicResults(json.results ?? []);
    } catch {
      setDynamicResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchDynamic(query), 220);
    return () => clearTimeout(t);
  }, [query, fetchDynamic]);

  // Filter static pages
  const q = query.toLowerCase();
  const matchedPages = query.length === 0
    ? PAGES.slice(0, 6)
    : PAGES.filter(
        (p) => p.title.toLowerCase().includes(q) ||
               p.keywords.some((k) => k.includes(q)),
      ).slice(0, 5);

  // Combined list for keyboard nav
  type CombinedResult =
    | { kind: "page"; item: PageShortcut }
    | { kind: "dynamic"; item: SearchResult };

  const combined: CombinedResult[] = [
    ...matchedPages.map((p) => ({ kind: "page" as const, item: p })),
    ...dynamicResults.map((r) => ({ kind: "dynamic" as const, item: r })),
  ];

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, combined.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && combined[activeIndex]) {
      const item = combined[activeIndex];
      navigate(item.item.href);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9990,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(2px)",
          animation: "searchFadeIn 0.15s ease both",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "clamp(12px, 12vh, 80px)", left: "50%", transform: "translateX(-50%)",
        zIndex: 9991,
        width: "min(600px, calc(100vw - 24px))",
        background: "white",
        borderRadius: 16,
        boxShadow: "0 24px 64px rgba(83,74,183,0.18), 0 4px 24px rgba(0,0,0,0.12)",
        overflow: "hidden",
        animation: "searchSlideDown 0.18s cubic-bezier(0.34,1.4,0.64,1) both",
      }}>
        <style>{`
          @keyframes searchFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes searchSlideDown { from { opacity: 0; transform: translateX(-50%) translateY(-12px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
        `}</style>

        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid #f3f4f6",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="#9ca3af" strokeWidth="2" />
            <path d="M16.5 16.5L21 21" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, investors, documents…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 15, color: "#111827",
              background: "transparent",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}>
              <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
              <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <kbd style={{
            fontSize: 10, fontWeight: 600, color: "#9ca3af",
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            borderRadius: 4, padding: "2px 6px",
          }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {combined.length === 0 && query.length >= 2 && !loading && (
            <p style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Page results section */}
          {matchedPages.length > 0 && (
            <div>
              <p style={{ padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".08em" }}>
                {query.length === 0 ? "Quick links" : "Pages"}
              </p>
              {matchedPages.map((page, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => navigate(page.href)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 18px", border: "none", cursor: "pointer", textAlign: "left",
                      background: isActive ? "#EEEDFE" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: "#f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <TypeIcon type="page" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{page.title}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{page.subtitle}</span>
                    </span>
                    {isActive && (
                      <kbd style={{ fontSize: 10, color: "#9ca3af", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px" }}>
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Dynamic results */}
          {dynamicResults.length > 0 && (
            <div style={{ borderTop: matchedPages.length > 0 ? "1px solid #f3f4f6" : undefined }}>
              <p style={{ padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".08em" }}>
                {dynamicResults[0]?.type === "contact" ? "Investors" :
                 dynamicResults[0]?.type === "document" ? "Documents" : "Data"}
              </p>
              {dynamicResults.map((r, i) => {
                const idx = matchedPages.length + i;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(r.href)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 18px", border: "none", cursor: "pointer", textAlign: "left",
                      background: isActive ? "#EEEDFE" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: "#EEEDFE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <TypeIcon type={r.type} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      {r.subtitle && <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{r.subtitle}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty + no query hint */}
          {query.length === 0 && (
            <p style={{ padding: "10px 18px 14px", fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              Type to search investors, documents, deal rooms…
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "8px 18px",
          borderTop: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: 12,
          background: "#fafafa",
        }}>
          {[
            ["↑↓", "navigate"],
            ["↵", "open"],
            ["esc", "close"],
          ].map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9ca3af" }}>
              <kbd style={{ fontSize: 10, background: "#e5e7eb", borderRadius: 3, padding: "1px 5px", fontFamily: "inherit" }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
