"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceId } from "@/lib/workspace-nav";
import type { SearchResult as FounderSearchResult } from "@/app/api/founder/search/route";
import type { AdminSearchResult } from "@/app/api/admin/search/route";

type SearchResult = FounderSearchResult | AdminSearchResult;

// ── Static page shortcuts ─────────────────────────────────────────────────────

type PageShortcut = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
  workspace: WorkspaceId | "all";
};

const PAGES: PageShortcut[] = [
  // Founder
  { id: "dashboard",   title: "Dashboard",            subtitle: "Founder terminal",       href: "/founder",                       keywords: ["home", "overview", "dashboard"],           workspace: "founder" },
  { id: "readiness",   title: "Readiness checklist",  subtitle: "Score & documents",      href: "/founder/readiness",             keywords: ["readiness", "score", "checklist"],         workspace: "founder" },
  { id: "documents",   title: "Documents",            subtitle: "Upload & manage files",  href: "/founder/documents",             keywords: ["docs", "upload", "files", "pitch deck"],   workspace: "founder" },
  { id: "crm",         title: "Investor CRM",         subtitle: "Outreach & contacts",    href: "/founder/investors/outreach",    keywords: ["crm", "contacts", "outreach"],             workspace: "founder" },
  { id: "pipeline",    title: "Investor pipeline",    subtitle: "Track your funnel",      href: "/founder/investor-pipeline",     keywords: ["pipeline", "funnel", "investors"],         workspace: "founder" },
  { id: "matching",    title: "Investor matching",    subtitle: "Platform matches",       href: "/founder/investors/matches",     keywords: ["matches", "matching", "recommended"],      workspace: "founder" },
  { id: "deal-rooms",  title: "Deal rooms",           subtitle: "Data room access",       href: "/founder/deal-room",             keywords: ["deal", "room", "data room"],               workspace: "founder" },
  { id: "capital",     title: "Capital raise",        subtitle: "Fundraising overview",   href: "/founder/capital-raise",         keywords: ["capital", "raise", "fundraising"],         workspace: "founder" },
  { id: "milestones",  title: "Milestones",           subtitle: "Track your progress",    href: "/founder/milestones",            keywords: ["milestones", "progress", "achievements"],  workspace: "founder" },
  { id: "raise-cmd",   title: "Raise command center", subtitle: "AI tools",               href: "/founder/command-center",        keywords: ["command", "center", "tools", "ai"],        workspace: "founder" },
  { id: "raise-kit",   title: "Raise toolkit",        subtitle: "Templates & guides",     href: "/founder/raise-toolkit",         keywords: ["toolkit", "templates"],                    workspace: "founder" },
  { id: "analytics",   title: "Analytics",            subtitle: "Insights & trends",      href: "/founder/analytics",             keywords: ["analytics", "insights", "metrics"],        workspace: "founder" },
  { id: "learning-f",  title: "Learning",             subtitle: "Capital modules",        href: "/founder/learning",              keywords: ["learning", "courses", "education"],        workspace: "founder" },
  { id: "settings-f",  title: "Company settings",     subtitle: "Profile & branding",     href: "/founder/settings",              keywords: ["settings", "profile", "company"],          workspace: "founder" },
  { id: "actions",     title: "Action center",        subtitle: "Tasks & priorities",     href: "/founder/actions",               keywords: ["actions", "tasks", "priorities"],          workspace: "founder" },
  // Investor
  { id: "inv-dash",    title: "Dashboard",            subtitle: "Investor workspace",     href: "/investor/dashboard",            keywords: ["home", "overview", "dashboard"],           workspace: "investor" },
  { id: "inv-opp",     title: "Opportunities",        subtitle: "Company matches",        href: "/investor/opportunities",        keywords: ["opportunities", "matches", "companies"],   workspace: "investor" },
  { id: "inv-port",    title: "Portfolio",            subtitle: "Active investments",     href: "/investor/portfolio",            keywords: ["portfolio", "investments"],                workspace: "investor" },
  { id: "inv-deal",    title: "Deal rooms",           subtitle: "Active deals",           href: "/investor/deal-room",            keywords: ["deal", "room"],                            workspace: "investor" },
  { id: "inv-learn",   title: "Learning",             subtitle: "Investor education",     href: "/investor/learning",             keywords: ["learning", "courses", "education"],        workspace: "investor" },
  { id: "inv-set",     title: "Investor settings",    subtitle: "Profile & integrations", href: "/investor/settings",             keywords: ["settings", "profile"],                     workspace: "investor" },
  // Admin
  { id: "ad-dash",     title: "Dashboard",            subtitle: "Admin home",             href: "/admin",                         keywords: ["home", "overview", "admin"],               workspace: "admin" },
  { id: "ad-contacts", title: "Contacts",             subtitle: "All contacts",           href: "/admin/contacts",                keywords: ["contacts", "people", "crm"],               workspace: "admin" },
  { id: "ad-ceo",      title: "CEO",                  subtitle: "CEO view",               href: "/admin/ceo",                     keywords: ["ceo", "executive"],                        workspace: "admin" },
  { id: "ad-sales",    title: "Sales",                subtitle: "Sales dashboard",        href: "/admin/sales",                   keywords: ["sales", "dashboard"],                      workspace: "admin" },
  { id: "ad-opps",     title: "Opportunities",        subtitle: "Sales",                  href: "/admin/sales/opportunities",     keywords: ["sales", "opportunities", "deals"],         workspace: "admin" },
  { id: "ad-pipe",     title: "Pipeline",             subtitle: "Sales",                  href: "/admin/sales/pipeline",          keywords: ["sales", "pipeline"],                       workspace: "admin" },
  { id: "ad-contr",    title: "Contracts",            subtitle: "Sales",                  href: "/admin/sales/contracts",         keywords: ["sales", "contracts", "spv", "proposal"],   workspace: "admin" },
  { id: "ad-sched",    title: "Scheduled emails",     subtitle: "Sales",                  href: "/admin/sales/scheduled-emails",  keywords: ["sales", "scheduled", "emails", "send"],    workspace: "admin" },
  { id: "ad-sales-s",  title: "Sales settings",       subtitle: "Sales",                  href: "/admin/sales/settings",          keywords: ["sales", "settings"],                       workspace: "admin" },
  { id: "ad-mkt",      title: "Marketing",            subtitle: "Marketing dashboard",    href: "/admin/marketing",               keywords: ["marketing", "dashboard"],                  workspace: "admin" },
  { id: "ad-mkt-plan", title: "Marketing plan",       subtitle: "Marketing",              href: "/admin/marketing/plan",          keywords: ["marketing", "plan"],                       workspace: "admin" },
  { id: "ad-mkt-con",  title: "Marketing contacts",   subtitle: "Marketing",              href: "/admin/marketing/contacts",      keywords: ["marketing", "contacts", "leads"],          workspace: "admin" },
  { id: "ad-lists",    title: "Lists",                subtitle: "Marketing",              href: "/admin/marketing/lists",         keywords: ["marketing", "lists", "segments"],          workspace: "admin" },
  { id: "ad-camp",     title: "Campaigns",            subtitle: "Marketing",              href: "/admin/marketing/campaigns",     keywords: ["marketing", "campaigns", "match"],         workspace: "admin" },
  { id: "ad-notices",  title: "Deal notices",         subtitle: "Marketing",              href: "/admin/marketing/deal-notices",  keywords: ["marketing", "deal", "notices"],            workspace: "admin" },
  { id: "ad-partner",  title: "Partner codes",        subtitle: "Marketing",              href: "/admin/marketing/partner-codes", keywords: ["marketing", "partner", "codes"],           workspace: "admin" },
  { id: "ad-seq",      title: "Sequences",            subtitle: "Marketing",              href: "/admin/marketing/sequences",     keywords: ["marketing", "sequences", "drip"],          workspace: "admin" },
  { id: "ad-tmpl",     title: "Templates",            subtitle: "Marketing",              href: "/admin/marketing/templates",     keywords: ["marketing", "templates", "email"],         workspace: "admin" },
  { id: "ad-testi",    title: "Testimonials",         subtitle: "Marketing",              href: "/admin/marketing/testimonials",  keywords: ["marketing", "testimonials", "reviews"],    workspace: "admin" },
  { id: "ad-mkt-an",   title: "Marketing analytics",  subtitle: "Marketing",              href: "/admin/marketing/analytics",     keywords: ["marketing", "analytics", "metrics"],       workspace: "admin" },
  { id: "ad-aeo",      title: "AEO",                  subtitle: "Marketing",              href: "/admin/marketing/aeo",           keywords: ["marketing", "aeo", "seo"],                 workspace: "admin" },
  { id: "ad-supp",     title: "Suppressions",         subtitle: "Marketing",              href: "/admin/marketing/suppressions",  keywords: ["marketing", "suppressions", "unsubscribe"], workspace: "admin" },
  { id: "ad-ir",       title: "Investor Relations",   subtitle: "IR dashboard",           href: "/admin/ir",                      keywords: ["ir", "investor", "relations", "dashboard"], workspace: "admin" },
  { id: "ad-ir-proj",  title: "IR projects",          subtitle: "Investor Relations",     href: "/admin/ir/projects",             keywords: ["ir", "investor", "projects"],              workspace: "admin" },
  { id: "ad-ir-task",  title: "IR tasks",             subtitle: "Investor Relations",     href: "/admin/ir/tasks",                keywords: ["ir", "investor", "tasks"],                 workspace: "admin" },
  { id: "ad-ir-imp",   title: "Odoo import",          subtitle: "Investor Relations",     href: "/admin/ir/import",               keywords: ["ir", "odoo", "import"],                    workspace: "admin" },
  { id: "ad-dir",      title: "Investor Directory",   subtitle: "Directory overview",     href: "/admin/investor-directory",      keywords: ["investor", "directory", "overview"],       workspace: "admin" },
  { id: "ad-dir-rec",  title: "Directory records",    subtitle: "Investor Directory",     href: "/admin/investor-directory/records",      keywords: ["investor", "directory", "records"], workspace: "admin" },
  { id: "ad-dir-imp",  title: "Directory imports",    subtitle: "Investor Directory",     href: "/admin/investor-directory/imports",      keywords: ["investor", "directory", "imports"], workspace: "admin" },
  { id: "ad-dir-ver",  title: "Directory verification", subtitle: "Investor Directory",   href: "/admin/investor-directory/verification", keywords: ["investor", "directory", "verification"], workspace: "admin" },
  { id: "ad-dir-acc",  title: "Directory access",     subtitle: "Investor Directory",     href: "/admin/investor-directory/access",       keywords: ["investor", "directory", "access"],  workspace: "admin" },
  { id: "ad-dir-use",  title: "Directory usage",      subtitle: "Investor Directory",     href: "/admin/investor-directory/usage",        keywords: ["investor", "directory", "usage"],   workspace: "admin" },
  { id: "ad-acct",     title: "Accounting",           subtitle: "Accounting dashboard",   href: "/admin/accounting",              keywords: ["accounting", "dashboard", "finance"],      workspace: "admin" },
  { id: "ad-cust",     title: "Customers",            subtitle: "Accounting",             href: "/admin/accounting/customers",    keywords: ["accounting", "customers", "clients"],      workspace: "admin" },
  { id: "ad-inv",      title: "Invoices",             subtitle: "Accounting",             href: "/admin/accounting/invoices",     keywords: ["accounting", "invoices", "billing"],       workspace: "admin" },
  { id: "ad-pay",      title: "Payments",             subtitle: "Accounting",             href: "/admin/accounting/payments",     keywords: ["accounting", "payments"],                  workspace: "admin" },
  { id: "ad-bank",     title: "Bank",                 subtitle: "Accounting",             href: "/admin/accounting/bank",         keywords: ["accounting", "bank", "plaid"],             workspace: "admin" },
  { id: "ad-rep",      title: "Accounting reports",   subtitle: "Accounting",             href: "/admin/accounting/reports",      keywords: ["accounting", "reports", "statements"],     workspace: "admin" },
  { id: "ad-acct-s",   title: "Accounting settings",  subtitle: "Accounting",             href: "/admin/accounting/settings",     keywords: ["accounting", "settings"],                  workspace: "admin" },
  { id: "ad-social",   title: "Social Media",         subtitle: "Posts & accounts",       href: "/admin/social",                  keywords: ["social", "media", "linkedin", "posts"],    workspace: "admin" },
  { id: "ad-events",   title: "Events",               subtitle: "All events",             href: "/admin/events",                  keywords: ["events", "expo", "all events"],            workspace: "admin" },
  { id: "ad-ev-app",   title: "Event applications",   subtitle: "Events",                 href: "/admin/events/applications",     keywords: ["events", "applications"],                  workspace: "admin" },
  { id: "ad-ev-spon",  title: "Event sponsors",       subtitle: "Events",                 href: "/admin/events/sponsors",         keywords: ["events", "sponsors"],                      workspace: "admin" },
  { id: "ad-ev-tmpl",  title: "Event template",       subtitle: "Events",                 href: "/admin/events/email",            keywords: ["events", "template", "email"],             workspace: "admin" },
  { id: "ad-ev-inv",   title: "Event invitations",    subtitle: "Events",                 href: "/admin/events/invitations",      keywords: ["events", "invitations"],                   workspace: "admin" },
  { id: "ad-ev-reg",   title: "Event registration",   subtitle: "Events",                 href: "/admin/events/registrations",    keywords: ["events", "registration", "registrations", "attendees"], workspace: "admin" },
  { id: "ad-ev-net",   title: "Networking matching",  subtitle: "Events",                 href: "/admin/events/networking",       keywords: ["events", "networking", "matching"],        workspace: "admin" },
  { id: "ad-ev-bro",   title: "Event brochure",       subtitle: "Events",                 href: "/admin/events/brochure",         keywords: ["events", "brochure"],                      workspace: "admin" },
  { id: "ad-ev-ana",   title: "Event analytics",      subtitle: "Events",                 href: "/admin/events/analytics",        keywords: ["events", "analytics"],                     workspace: "admin" },
  { id: "ad-ev-gam",   title: "Gamification",         subtitle: "Events",                 href: "/admin/events/gamification",     keywords: ["events", "gamification", "points"],        workspace: "admin" },
  { id: "ad-voice",    title: "Voice command center", subtitle: "Voice",                  href: "/admin/voice",                   keywords: ["voice", "calling", "command", "center"],   workspace: "admin" },
  { id: "ad-v-camp",   title: "Voice campaigns",      subtitle: "Voice",                  href: "/admin/voice/campaigns",         keywords: ["voice", "campaigns"],                      workspace: "admin" },
  { id: "ad-v-calls",  title: "Call review",          subtitle: "Voice",                  href: "/admin/voice/calls",             keywords: ["voice", "calls", "review"],                workspace: "admin" },
  { id: "ad-v-cons",   title: "Consent ledger",       subtitle: "Voice",                  href: "/admin/voice/consent-ledger",    keywords: ["voice", "consent", "ledger"],              workspace: "admin" },
  { id: "ad-v-perf",   title: "Voice performance",    subtitle: "Voice",                  href: "/admin/voice/performance",       keywords: ["voice", "performance"],                    workspace: "admin" },
  { id: "ad-inbox",    title: "Inbox",                subtitle: "Communication",          href: "/admin/inbox",                   keywords: ["inbox", "email", "mail", "communication"], workspace: "admin" },
  { id: "ad-cal",      title: "Calendar",             subtitle: "Communication",          href: "/admin/calendar",                keywords: ["calendar", "communication"],               workspace: "admin" },
  { id: "ad-schedule", title: "Scheduling",           subtitle: "Communication",          href: "/admin/schedule",                keywords: ["scheduling", "schedule", "booking"],       workspace: "admin" },
  { id: "ad-meet",     title: "Meet",                 subtitle: "Communication",          href: "/admin/meet",                    keywords: ["meet", "video", "communication"],          workspace: "admin" },
  { id: "ad-meetings", title: "Meetings",             subtitle: "Communication",          href: "/admin/meetings",                keywords: ["meetings", "communication"],               workspace: "admin" },
  { id: "ad-sign",     title: "E-Signatures",         subtitle: "Communication",          href: "/admin/signatures",              keywords: ["signatures", "esign", "sign", "docs"],     workspace: "admin" },
  { id: "ad-tasks",    title: "Tasks",                subtitle: "Communication",          href: "/admin/tasks",                   keywords: ["tasks", "todo", "communication"],          workspace: "admin" },
  { id: "ad-actions",  title: "Action Center",        subtitle: "Operational tools",      href: "/admin/actions",                 keywords: ["actions", "operational", "tools"],         workspace: "admin" },
  { id: "ad-activity", title: "Account activity",     subtitle: "Feed",                   href: "/admin/activity",                keywords: ["activity", "feed", "account"],             workspace: "admin" },
];

// ── Type icons ────────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: SearchResult["type"] | "page" }) {
  const ACCENT = "#2E78F5";

  if (type === "contact") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke={ACCENT} strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  if (type === "investor") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke={ACCENT} strokeWidth="2" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
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
  if (type === "deal_room" || type === "company" || type === "event") return (
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

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  contact: "Contacts",
  investor: "Pipeline investors",
  document: "Documents",
  deal_room: "Deal rooms",
  company: "Companies",
  event: "Events",
};

// ── Main modal ────────────────────────────────────────────────────────────────

type Props = { workspace?: WorkspaceId };

export function GlobalSearchModal({ workspace = "founder" }: Props) {
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

  // Focus + reset when opened
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setDynamicResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced API search (founder only)
  const fetchDynamic = useCallback(async (q: string) => {
    if ((workspace !== "founder" && workspace !== "admin") || q.length < 2) { setDynamicResults([]); return; }
    setLoading(true);
    try {
      const base = workspace === "admin" ? "/api/admin/search" : "/api/founder/search";
      const res = await fetch(`${base}?q=${encodeURIComponent(q)}`);
      const json = await res.json() as { results?: SearchResult[] };
      setDynamicResults(json.results ?? []);
    } catch {
      setDynamicResults([]);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    const t = setTimeout(() => void fetchDynamic(query), 220);
    return () => clearTimeout(t);
  }, [query, fetchDynamic]);

  // Filter static pages for this workspace
  const q = query.toLowerCase();
  const workspacePages = PAGES.filter((p) => p.workspace === workspace || p.workspace === "all");
  const matchedPages = query.length === 0
    ? workspacePages.slice(0, 6)
    : workspacePages.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.includes(q)),
      ).slice(0, workspace === "admin" ? 8 : 5);

  // Group dynamic results by type
  const grouped = new Map<SearchResult["type"], SearchResult[]>();
  for (const r of dynamicResults) {
    const arr = grouped.get(r.type) ?? [];
    arr.push(r);
    grouped.set(r.type, arr);
  }

  // Flat combined list for keyboard nav index
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
    } else if (e.key === "Enter") {
      const item = combined[activeIndex];
      if (item) navigate(item.item.href);
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        style={{
          position: "fixed",
          top: "clamp(12px, 12vh, 80px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 9991,
          width: "min(600px, calc(100vw - 24px))",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(83,74,183,0.18), 0 4px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          animation: "searchSlideDown 0.18s cubic-bezier(0.34,1.4,0.64,1) both",
        }}
      >
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
            placeholder={workspace === "founder" ? "Search pages, investors, documents…" : workspace === "admin" ? "Search pages, contacts, companies, events…" : "Search pages…"}
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 15, color: "#111827",
              background: "transparent",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
              <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
              <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#2E78F5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <kbd style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>

          {/* Empty query with no results */}
          {combined.length === 0 && query.length >= 2 && !loading && (
            <p style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Page shortcuts */}
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
                    <span style={{ width: 28, height: 28, borderRadius: 7, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <TypeIcon type="page" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{page.title}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{page.subtitle}</span>
                    </span>
                    {isActive && (
                      <kbd style={{ fontSize: 10, color: "#9ca3af", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Dynamic results — grouped by type */}
          {[...grouped.entries()].map(([type, rows]) => {
            const sectionStart = matchedPages.length + dynamicResults.indexOf(rows[0]!);
            return (
              <div key={type} style={{ borderTop: "1px solid #f3f4f6" }}>
                <p style={{ padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  {TYPE_LABELS[type]}
                </p>
                {rows.map((r, i) => {
                  const idx = sectionStart + i;
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
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <TypeIcon type={r.type} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                        {r.subtitle && <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{r.subtitle}</span>}
                      </span>
                      {isActive && (
                        <kbd style={{ fontSize: 10, color: "#9ca3af", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Hint when empty query */}
          {query.length === 0 && (workspace === "founder" || workspace === "admin") && (
            <p style={{ padding: "6px 18px 14px", fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
              {workspace === "admin" ? "Type to search contacts, companies, events…" : "Type to search investors, documents, deal rooms…"}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 12, background: "#fafafa" }}>
          {([["↑↓", "navigate"], ["↵", "open"], ["esc", "close"]] as [string, string][]).map(([key, label]) => (
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
