"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminWorkspaceNavSections,
  getFounderWorkspaceNavSections,
  getInvestorWorkspaceNavSections,
  type WorkspaceId,
} from "@/lib/workspace-nav";
import { buildSearchIndex, searchMenu } from "@/lib/nav-search";
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
  /** A section inside a page (opens the page scrolled to that section). */
  section?: boolean;
  /** Menu search hits: the menu trail to show, and why the page matched. */
  path?: string;
  reason?: string;
};

const PAGES: PageShortcut[] = [
  // Founder
  { id: "f-dash", title: "Dashboard", subtitle: "Founder terminal", href: "/founder", keywords: ["home", "overview", "terminal"], workspace: "founder" },
  { id: "f-journey", title: "Journey", subtitle: "Your fundraising journey", href: "/founder/journey", keywords: ["journey", "stages", "roadmap", "progress"], workspace: "founder" },
  { id: "f-actions", title: "Action center", subtitle: "Tasks and priorities", href: "/founder/actions", keywords: ["actions", "tasks", "priorities", "next steps", "to do"], workspace: "founder" },
  { id: "f-outreach-report", title: "Outreach report", subtitle: "Investor outreach results", href: "/founder/outreach-report", keywords: ["outreach", "report", "emails sent"], workspace: "founder" },
  { id: "f-command-center", title: "Raise command center", subtitle: "AI tools for your raise", href: "/founder/command-center", keywords: ["command", "center", "tools", "ai"], workspace: "founder" },
  { id: "f-onboarding", title: "Onboarding", subtitle: "Set up your company", href: "/founder/onboarding", keywords: ["onboarding", "setup", "get started", "company profile"], workspace: "founder" },
  { id: "f-stage-onb", title: "Stage 1 overview", subtitle: "Onboarding stage", href: "/founder/stages/onboarding", keywords: ["stage 1", "stage one", "onboarding stage"], workspace: "founder" },
  { id: "f-readiness", title: "Readiness checklist", subtitle: "Score and documents", href: "/founder/readiness", keywords: ["readiness", "score", "checklist", "investor ready"], workspace: "founder" },
  { id: "f-wizard", title: "Readiness wizard", subtitle: "Step by step readiness", href: "/founder/readiness/wizard", keywords: ["wizard", "readiness", "guided"], workspace: "founder" },
  { id: "f-data-room", title: "Data room", subtitle: "Organize diligence files", href: "/founder/readiness/data-room", keywords: ["data room", "dataroom", "files", "diligence"], workspace: "founder" },
  { id: "f-diligence", title: "Diligence", subtitle: "Diligence checklist", href: "/founder/readiness/diligence", keywords: ["diligence", "due diligence", "checklist"], workspace: "founder" },
  { id: "f-documents", title: "Documents", subtitle: "Upload and manage files", href: "/founder/documents", keywords: ["docs", "upload", "files", "pitch deck"], workspace: "founder" },
  { id: "f-preview", title: "Investor preview", subtitle: "See what investors see", href: "/founder/preview", keywords: ["preview", "investor view", "profile preview"], workspace: "founder" },
  { id: "f-business-plan", title: "Business plan", subtitle: "Plan builder", href: "/founder/business-plan", keywords: ["business plan", "plan"], workspace: "founder" },
  { id: "f-pitch-deck", title: "Pitch deck", subtitle: "Build your deck", href: "/founder/pitch-deck", keywords: ["pitch deck", "deck", "slides", "presentation"], workspace: "founder" },
  { id: "f-pitch-analyzer", title: "Pitch deck analyzer", subtitle: "AI deck feedback", href: "/founder/pitch-deck-analyzer", keywords: ["pitch deck analyzer", "deck review", "deck feedback", "analyze deck"], workspace: "founder" },
  { id: "f-market-claim", title: "Market claim", subtitle: "Size your market", href: "/founder/market-claim", keywords: ["market claim", "tam", "market size", "market"], workspace: "founder" },
  { id: "f-financial-model", title: "Financial model", subtitle: "Projections", href: "/founder/financial-model", keywords: ["financial model", "financials", "projections", "forecast", "model"], workspace: "founder" },
  { id: "f-cap-table", title: "Cap table", subtitle: "Ownership and rounds", href: "/founder/cap-table", keywords: ["cap table", "captable", "equity", "ownership", "shares"], workspace: "founder" },
  { id: "f-valuation", title: "Valuation", subtitle: "What is the company worth", href: "/founder/valuation", keywords: ["valuation", "value", "worth"], workspace: "founder" },
  { id: "f-reg-cf", title: "Reg CF", subtitle: "Regulation crowdfunding", href: "/founder/reg-cf", keywords: ["reg cf", "regulation cf", "crowdfunding", "form c"], workspace: "founder" },
  { id: "f-report", title: "Report", subtitle: "Readiness report", href: "/founder/report", keywords: ["report", "readiness report"], workspace: "founder" },
  { id: "f-pitch-practice", title: "Pitch practice", subtitle: "Rehearse your pitch", href: "/founder/pitch-practice", keywords: ["pitch practice", "rehearse", "practice", "pitch"], workspace: "founder" },
  { id: "f-board-prep", title: "Board prep", subtitle: "Prepare for the board", href: "/founder/board-prep", keywords: ["board prep", "board", "board meeting"], workspace: "founder" },
  { id: "f-term-sheet", title: "Term sheet", subtitle: "Understand your terms", href: "/founder/term-sheet", keywords: ["term sheet", "terms", "safe", "convertible"], workspace: "founder" },
  { id: "f-kpi-glossary", title: "KPI glossary", subtitle: "Metrics explained", href: "/founder/kpi-glossary", keywords: ["kpi", "glossary", "metrics definitions"], workspace: "founder" },
  { id: "f-raise-toolkit", title: "Raise toolkit", subtitle: "Templates and guides", href: "/founder/raise-toolkit", keywords: ["toolkit", "templates", "guides"], workspace: "founder" },
  { id: "f-investors", title: "Investors", subtitle: "Your investor list", href: "/founder/investors", keywords: ["investors", "investor list"], workspace: "founder" },
  { id: "f-stage-mkt", title: "Stage 3 overview", subtitle: "Marketing stage", href: "/founder/stages/marketing", keywords: ["stage 3", "stage three", "marketing stage"], workspace: "founder" },
  { id: "f-contacts", title: "Contacts", subtitle: "Investor contacts", href: "/founder/contacts", keywords: ["contacts", "people", "add contact"], workspace: "founder" },
  { id: "f-matches", title: "Matches", subtitle: "Investor matches", href: "/founder/matches", keywords: ["matches", "matched investors"], workspace: "founder" },
  { id: "f-matching", title: "Investor matching", subtitle: "Platform matches", href: "/founder/matching", keywords: ["matching", "recommended", "investor matching"], workspace: "founder" },
  { id: "f-crm", title: "Investor CRM", subtitle: "Outreach and contacts", href: "/founder/investors/outreach", keywords: ["crm", "outreach", "contacts", "emails"], workspace: "founder" },
  { id: "f-inv-matches", title: "Investor matches", subtitle: "Recommended investors", href: "/founder/investors/matches", keywords: ["investor matches", "recommended investors"], workspace: "founder" },
  { id: "f-pipeline", title: "Investor pipeline", subtitle: "Track your funnel", href: "/founder/investor-pipeline", keywords: ["pipeline", "funnel", "investors", "stages"], workspace: "founder" },
  { id: "f-directory", title: "Investor directory", subtitle: "Browse investors", href: "/founder/investor-directory", keywords: ["directory", "browse investors", "find investors"], workspace: "founder" },
  { id: "f-deploy", title: "Deploy", subtitle: "Launch your outreach", href: "/founder/deploy", keywords: ["deploy", "launch", "campaign"], workspace: "founder" },
  { id: "f-deploy-social", title: "Social deploy", subtitle: "Share on social", href: "/founder/deploy/social", keywords: ["social", "linkedin", "posts"], workspace: "founder" },
  { id: "f-ir-agent", title: "IR agent", subtitle: "Your AI investor relations agent", href: "/founder/ir-agent", keywords: ["ir agent", "agent", "johnny", "ai agent"], workspace: "founder" },
  { id: "f-present", title: "Present at events", subtitle: "Pitch at live events", href: "/founder/events/present", keywords: ["present", "pitch event", "demo day"], workspace: "founder" },
  { id: "f-private-market", title: "Private market", subtitle: "Marketplace", href: "/founder/private-market", keywords: ["private market", "marketplace"], workspace: "founder" },
  { id: "f-marketplace-new", title: "List on marketplace", subtitle: "Create a listing", href: "/founder/marketplace/new", keywords: ["marketplace", "listing", "list", "new listing"], workspace: "founder" },
  { id: "f-deal-rooms", title: "Deal rooms", subtitle: "Data room access", href: "/founder/deal-room", keywords: ["deal", "room", "data room", "deal room"], workspace: "founder" },
  { id: "f-stage-close", title: "Stage 4 overview", subtitle: "Closing stage", href: "/founder/stages/closing", keywords: ["stage 4", "stage four", "closing stage"], workspace: "founder" },
  { id: "f-offering-type", title: "Offering type", subtitle: "Choose how you raise", href: "/founder/offering-type", keywords: ["offering", "offering type", "reg d", "reg cf"], workspace: "founder" },
  { id: "f-spvs", title: "SPVs", subtitle: "Special purpose vehicles", href: "/founder/spvs", keywords: ["spv", "spvs", "vehicle", "closing"], workspace: "founder" },
  { id: "f-capital", title: "Capital raise", subtitle: "Fundraising overview", href: "/founder/capital-raise", keywords: ["capital", "raise", "fundraising", "round"], workspace: "founder" },
  { id: "f-investor-update", title: "Investor update", subtitle: "Update your investors", href: "/founder/investor-update", keywords: ["investor update", "update", "newsletter"], workspace: "founder" },
  { id: "f-milestones", title: "Milestones", subtitle: "Track your progress", href: "/founder/milestones", keywords: ["milestones", "progress", "achievements"], workspace: "founder" },
  { id: "f-analytics", title: "Analytics", subtitle: "Insights and trends", href: "/founder/analytics", keywords: ["analytics", "insights", "metrics", "views"], workspace: "founder" },
  { id: "f-inbox", title: "Inbox", subtitle: "Your email", href: "/founder/inbox", keywords: ["inbox", "email", "mail"], workspace: "founder" },
  { id: "f-messages", title: "Messages", subtitle: "Conversations", href: "/founder/messages", keywords: ["messages", "chat", "dm"], workspace: "founder" },
  { id: "f-updates", title: "Updates", subtitle: "What is new", href: "/founder/updates", keywords: ["updates", "news", "notifications"], workspace: "founder" },
  { id: "f-calendar", title: "Calendar", subtitle: "Your meetings", href: "/founder/calendar", keywords: ["calendar", "meetings"], workspace: "founder" },
  { id: "f-schedule", title: "Schedule a meeting", subtitle: "Book time", href: "/founder/schedule", keywords: ["schedule", "book", "meeting", "booking"], workspace: "founder" },
  { id: "f-events", title: "Events", subtitle: "Upcoming events", href: "/founder/events", keywords: ["events", "webinars"], workspace: "founder" },
  { id: "f-interest", title: "Investor interest", subtitle: "Who is interested", href: "/founder/investor-interest", keywords: ["interest", "interested", "investor interest"], workspace: "founder" },
  { id: "f-tasks", title: "Tasks", subtitle: "Your to do list", href: "/founder/tasks", keywords: ["tasks", "to do", "todo"], workspace: "founder" },
  { id: "f-help", title: "Help", subtitle: "Guides and answers", href: "/founder/help", keywords: ["help", "how to", "guide", "faq"], workspace: "founder" },
  { id: "f-support", title: "Support", subtitle: "Contact support", href: "/founder/support", keywords: ["support", "contact support", "ticket"], workspace: "founder" },
  { id: "f-learning", title: "Learning", subtitle: "Capital modules", href: "/founder/learning", keywords: ["learning", "courses", "education"], workspace: "founder" },
  { id: "f-courses", title: "Courses", subtitle: "All courses", href: "/founder/learning/courses", keywords: ["courses", "lessons"], workspace: "founder" },
  { id: "f-learn-plan", title: "Learning plan", subtitle: "Your plan", href: "/founder/learning/plan", keywords: ["learning plan", "study plan"], workspace: "founder" },
  { id: "f-learn-progress", title: "Learning progress", subtitle: "How far you are", href: "/founder/learning/progress", keywords: ["learning progress", "completed"], workspace: "founder" },
  { id: "f-settings", title: "Company settings", subtitle: "Profile and branding", href: "/founder/settings", keywords: ["settings", "profile", "company", "branding"], workspace: "founder" },
  { id: "f-team", title: "Team", subtitle: "Invite teammates", href: "/founder/settings/team", keywords: ["team", "members", "invite", "users"], workspace: "founder" },
  { id: "f-billing", title: "Billing", subtitle: "Plan and invoices", href: "/founder/settings/billing", keywords: ["billing", "plan", "subscription", "payment", "invoices"], workspace: "founder" },
  { id: "f-integrations", title: "Integrations", subtitle: "Connected apps", href: "/founder/settings/integrations", keywords: ["integrations", "connect", "apps"], workspace: "founder" },
  { id: "f-feedback", title: "Feedback", subtitle: "Tell us what you think", href: "/founder/settings/feedback", keywords: ["feedback", "suggest", "report a problem"], workspace: "founder" },
  // Investor
  { id: "i-dash", title: "Dashboard", subtitle: "Investor workspace", href: "/investor/dashboard", keywords: ["home", "overview"], workspace: "investor" },
  { id: "i-profile", title: "Profile", subtitle: "Your investor profile", href: "/investor/onboarding", keywords: ["profile", "onboarding", "preferences", "thesis"], workspace: "investor" },
  { id: "i-verification", title: "Verification", subtitle: "Accreditation", href: "/investor/verification", keywords: ["verification", "accredited", "accreditation", "kyc"], workspace: "investor" },
  { id: "i-opp", title: "Opportunities", subtitle: "Company matches", href: "/investor/opportunities", keywords: ["opportunities", "companies", "deals", "browse"], workspace: "investor" },
  { id: "i-watchlist", title: "Watchlist", subtitle: "Companies you follow", href: "/investor/watchlist", keywords: ["watchlist", "saved", "following", "favorites"], workspace: "investor" },
  { id: "i-interest", title: "Interest pipeline", subtitle: "Where your interest stands", href: "/investor/interest-pipeline", keywords: ["interest", "pipeline", "interest pipeline"], workspace: "investor" },
  { id: "i-deal-room", title: "Deal Room", subtitle: "Active deals", href: "/investor/deal-room", keywords: ["deal", "room", "deal room", "data room"], workspace: "investor" },
  { id: "i-deals", title: "Diligence", subtitle: "Open deals under review", href: "/investor/deals", keywords: ["diligence", "due diligence", "deals"], workspace: "investor" },
  { id: "i-matches", title: "Matches", subtitle: "Recommended companies", href: "/investor/matches", keywords: ["matches", "recommended"], workspace: "investor" },
  { id: "i-matching", title: "Matching preferences", subtitle: "Tune your matches", href: "/investor/matching", keywords: ["matching", "preferences", "criteria"], workspace: "investor" },
  { id: "i-partner-score", title: "Partner score", subtitle: "Your standing", href: "/investor/partner-score", keywords: ["partner score", "score", "rating"], workspace: "investor" },
  { id: "i-portfolio", title: "Portfolio", subtitle: "Active investments", href: "/investor/portfolio", keywords: ["portfolio", "investments", "holdings"], workspace: "investor" },
  { id: "i-spvs", title: "SPVs and closings", subtitle: "Deal closings", href: "/investor/spvs", keywords: ["spv", "spvs", "closings", "closing"], workspace: "investor" },
  { id: "i-activity", title: "Activity", subtitle: "Recent activity", href: "/investor/activity", keywords: ["activity", "history", "log"], workspace: "investor" },
  { id: "i-actions", title: "Action center", subtitle: "Tasks and priorities", href: "/investor/actions", keywords: ["actions", "action center", "next steps", "priorities"], workspace: "investor" },
  { id: "i-tasks", title: "Tasks", subtitle: "Your to do list", href: "/investor/tasks", keywords: ["tasks", "to do", "todo"], workspace: "investor" },
  { id: "i-inbox", title: "Inbox", subtitle: "Your email", href: "/investor/inbox", keywords: ["inbox", "email", "mail"], workspace: "investor" },
  { id: "i-messages", title: "Messages", subtitle: "Conversations", href: "/investor/messages", keywords: ["messages", "chat"], workspace: "investor" },
  { id: "i-calendar", title: "Calendar", subtitle: "Your meetings", href: "/investor/calendar", keywords: ["calendar", "meetings"], workspace: "investor" },
  { id: "i-schedule", title: "Schedule a meeting", subtitle: "Book time", href: "/investor/schedule", keywords: ["schedule", "book", "meeting"], workspace: "investor" },
  { id: "i-learning", title: "Learning", subtitle: "Investor education", href: "/investor/learning", keywords: ["learning", "courses", "education"], workspace: "investor" },
  { id: "i-analytics", title: "Analytics", subtitle: "Insights and trends", href: "/investor/analytics", keywords: ["analytics", "insights", "metrics"], workspace: "investor" },
  { id: "i-settings", title: "Investor settings", subtitle: "Profile and integrations", href: "/investor/settings", keywords: ["settings", "account", "integrations"], workspace: "investor" },
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
  { id: "ad-mkt-set", title: "Marketing settings", subtitle: "Marketing", href: "/admin/marketing/settings/notifications", keywords: ["marketing", "settings", "notifications"], workspace: "admin" },
  { id: "ad-alerts", title: "Account alerts", subtitle: "Account Activity", href: "/admin/activity/alerts", keywords: ["activity", "alerts"], workspace: "admin" },
  { id: "ad-assign", title: "Account assignments", subtitle: "Account Activity", href: "/admin/activity/assignments", keywords: ["activity", "assignment", "assignments"], workspace: "admin" },
  { id: "ad-irfun", title: "Investor Relations Funnel", subtitle: "Admin", href: "/admin/ir-funnel", keywords: ["ir", "funnel", "investor"], workspace: "admin" },
  { id: "ad-fit", title: "Fit funnel", subtitle: "Admin", href: "/admin/fit", keywords: ["fit", "funnel", "match review"], workspace: "admin" },
  { id: "ad-enrich", title: "Enrich data", subtitle: "Admin", href: "/admin/investors/enrich", keywords: ["enrich", "data", "investors"], workspace: "admin" },
  { id: "ad-crm", title: "Investor Relations CRM", subtitle: "CRM", href: "/admin/crm", keywords: ["crm", "activity", "investor"], workspace: "admin" },
  { id: "ad-crm-pipe", title: "CRM pipeline", subtitle: "CRM", href: "/admin/crm/pipeline", keywords: ["crm", "pipeline"], workspace: "admin" },
  { id: "ad-crm-msg", title: "CRM messages", subtitle: "CRM", href: "/admin/crm/messages", keywords: ["crm", "messages"], workspace: "admin" },
  { id: "ad-crm-out", title: "CRM outreach", subtitle: "CRM", href: "/admin/crm/outreach", keywords: ["crm", "outreach"], workspace: "admin" },
  { id: "ad-crm-unc", title: "Unclassified", subtitle: "CRM", href: "/admin/crm/unclassified", keywords: ["crm", "unclassified"], workspace: "admin" },
  { id: "ad-spvs", title: "SPVs", subtitle: "Admin", href: "/admin/spvs", keywords: ["spv", "spvs", "closings"], workspace: "admin" },
  { id: "ad-match", title: "Matching", subtitle: "Admin", href: "/admin/matching", keywords: ["matching", "matches"], workspace: "admin" },
  { id: "ad-prosp", title: "Prospect Investors", subtitle: "Matching", href: "/admin/matching/prospects", keywords: ["matching", "prospect", "investors"], workspace: "admin" },
  { id: "ad-oq", title: "Outreach Qualification", subtitle: "Admin", href: "/admin/outreach-qualification", keywords: ["outreach", "qualification", "gate"], workspace: "admin" },
  { id: "ad-port", title: "Portfolio", subtitle: "Admin", href: "/admin/portfolio", keywords: ["portfolio"], workspace: "admin" },
  { id: "ad-ready", title: "Readiness Scores", subtitle: "Admin", href: "/admin/readiness", keywords: ["readiness", "scores", "crr", "rating"], workspace: "admin" },
  { id: "ad-mktpl", title: "Marketplace Review", subtitle: "Admin", href: "/admin/marketplace", keywords: ["marketplace", "review", "private market"], workspace: "admin" },
  { id: "ad-pscore", title: "Partner Scores", subtitle: "Admin", href: "/admin/partner-scores", keywords: ["partner", "scores"], workspace: "admin" },
  { id: "ad-dealrooms", title: "Deal Rooms", subtitle: "Admin", href: "/admin/deal-rooms", keywords: ["deal", "rooms"], workspace: "admin" },
  { id: "ad-dtrack", title: "Diligence Tracker", subtitle: "Admin", href: "/admin/data-room", keywords: ["diligence", "tracker", "data room"], workspace: "admin" },
  { id: "ad-dreview", title: "Diligence Review", subtitle: "Admin", href: "/admin/diligence", keywords: ["diligence", "review"], workspace: "admin" },
  { id: "ad-analytics", title: "Analytics", subtitle: "Analytics", href: "/admin/analytics", keywords: ["analytics", "overview", "metrics"], workspace: "admin" },
  { id: "ad-funnels", title: "Activation funnels", subtitle: "Analytics", href: "/admin/funnels", keywords: ["analytics", "activation", "funnels"], workspace: "admin" },
  { id: "ad-reports", title: "Reports", subtitle: "Analytics", href: "/admin/reports", keywords: ["analytics", "reports"], workspace: "admin" },
  { id: "ad-msgact", title: "Founder and investor messages", subtitle: "Analytics", href: "/admin/message-activity", keywords: ["analytics", "messages", "activity"], workspace: "admin" },
  { id: "ad-insights", title: "Insights", subtitle: "Analytics", href: "/admin/insights", keywords: ["analytics", "insights"], workspace: "admin" },
  { id: "ad-compl", title: "Compliance", subtitle: "Admin", href: "/admin/compliance", keywords: ["compliance"], workspace: "admin" },
  { id: "ad-audit", title: "Audit", subtitle: "Admin", href: "/admin/audit", keywords: ["audit", "log"], workspace: "admin" },
  { id: "ad-companies", title: "Companies", subtitle: "Customer Support", href: "/admin/companies", keywords: ["companies", "customer", "support", "founders"], workspace: "admin" },
  { id: "ad-investors", title: "Investors", subtitle: "Customer Support", href: "/admin/investors", keywords: ["investors", "customer", "support"], workspace: "admin" },
  { id: "ad-supq", title: "Support queue", subtitle: "Customer Support", href: "/admin/support", keywords: ["support", "queue", "tickets"], workspace: "admin" },
  { id: "ad-suplog", title: "Support log", subtitle: "Customer Support", href: "/admin/support/log", keywords: ["support", "log"], workspace: "admin" },
  { id: "ad-stuck", title: "Stuck founders", subtitle: "Customer Support", href: "/admin/founders-stuck", keywords: ["stuck", "founders", "support"], workspace: "admin" },
  { id: "ad-intros", title: "Brokered Intros", subtitle: "Customer Support", href: "/admin/prospect-intros", keywords: ["brokered", "intros", "introductions"], workspace: "admin" },
  { id: "ad-aiuse", title: "AI usage and cost", subtitle: "Customer Support · AI spend by tool", href: "/admin/ai-usage", keywords: ["ai", "usage", "cost", "spend", "tokens", "claude", "vapi", "serper"], workspace: "admin" },
  { id: "ad-learn", title: "Learning overview", subtitle: "Learning", href: "/admin/learning", keywords: ["learning", "overview"], workspace: "admin" },
  { id: "ad-courses", title: "Courses", subtitle: "Learning", href: "/admin/learning/courses", keywords: ["learning", "courses"], workspace: "admin" },
  { id: "ad-roster", title: "Founder roster", subtitle: "Learning", href: "/admin/learning/founders", keywords: ["learning", "founder", "roster"], workspace: "admin" },
  { id: "ad-manual", title: "Operations Manual", subtitle: "Admin", href: "/admin/manual", keywords: ["operations", "manual", "guide", "help"], workspace: "admin" },
  { id: "ad-users", title: "User Management", subtitle: "Administration", href: "/admin/users/manage", keywords: ["users", "user management", "team", "staff"], workspace: "admin" },
  { id: "ad-perms", title: "User Permissions", subtitle: "Administration", href: "/admin/users/permissions", keywords: ["users", "permissions", "roles"], workspace: "admin" },
  { id: "ad-sync", title: "Contact Sync", subtitle: "Administration", href: "/admin/crm/connectors", keywords: ["contact", "sync", "connectors", "odoo"], workspace: "admin" },
  { id: "ad-billing", title: "Billing", subtitle: "Administration", href: "/admin/billing", keywords: ["billing", "subscriptions"], workspace: "admin" },
  { id: "ad-pricing", title: "Pricing", subtitle: "Administration", href: "/admin/pricing", keywords: ["pricing", "plans"], workspace: "admin" },
  { id: "ad-accounts", title: "Accounts", subtitle: "Administration", href: "/admin/accounts", keywords: ["accounts"], workspace: "admin" },
  { id: "ad-profile", title: "My Profile", subtitle: "Administration", href: "/admin/profile", keywords: ["profile", "my profile"], workspace: "admin" },
  { id: "ad-pfields", title: "Profile and fields", subtitle: "Administration", href: "/admin/profile-fields", keywords: ["profile", "fields", "industry", "vocabulary"], workspace: "admin" },
  { id: "ad-fc", title: "Feature Controls", subtitle: "Administration · site view, AI budget, limits, departments, stages", href: "/admin/feature-controls", keywords: ["feature", "controls", "settings", "flags"], workspace: "admin" },
  { id: "ad-integ", title: "Integrations", subtitle: "System", href: "/admin/integrations", keywords: ["integrations", "connect", "settings"], workspace: "admin" },
  { id: "ad-queues", title: "Queues", subtitle: "System", href: "/admin/queues", keywords: ["queues"], workspace: "admin" },
  { id: "ad-auto", title: "Automation", subtitle: "System", href: "/admin/automation", keywords: ["automation"], workspace: "admin" },
  { id: "ad-jobs", title: "Scheduled jobs", subtitle: "System", href: "/admin/scheduled-jobs", keywords: ["scheduled", "jobs", "cron"], workspace: "admin" },
  { id: "ad-pb", title: "Page Builder", subtitle: "System", href: "/admin/page-builder-lab", keywords: ["page", "builder", "website", "site", "landing", "settings", "pages"], workspace: "admin" },
  { id: "ad-health", title: "System Health", subtitle: "System", href: "/admin/system-health", keywords: ["system", "health", "status"], workspace: "admin" },
  { id: "ad-impexp", title: "Import / Export", subtitle: "System", href: "/admin/imports", keywords: ["import", "export", "csv"], workspace: "admin" },
  { id: "ad-beta", title: "Beta Operations", subtitle: "System", href: "/admin/beta-operations", keywords: ["beta", "operations"], workspace: "admin" },  { id: "sec-site-default-view", title: "Public site default view", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#site-default-view", keywords: ["website", "web site", "site default view", "default view", "browse the site", "ai mode", "landing", "homepage"], workspace: "admin", section: true },
  { id: "sec-outreach-automation", title: "Outreach automation", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#outreach-automation", keywords: ["outreach automation", "auto outreach", "automation toggle", "automated outreach"], workspace: "admin", section: true },
  { id: "sec-departments", title: "Departments", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#departments", keywords: ["departments", "teams", "department chips"], workspace: "admin", section: true },
  { id: "sec-ai-budget", title: "AI budget", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#ai-budget", keywords: ["ai budget", "budget", "ai cost cap", "spend limit", "claude budget", "monthly cap"], workspace: "admin", section: true },
  { id: "sec-ai-usage-limits", title: "AI usage limits", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#ai-usage-limits", keywords: ["ai usage limits", "usage limits", "run caps", "founder ai limits", "per founder limits"], workspace: "admin", section: true },
  { id: "sec-upload-limits", title: "Upload limits", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#upload-limits", keywords: ["upload limits", "file size", "upload size", "import limit"], workspace: "admin", section: true },
  { id: "sec-ir-agent", title: "IR agent controls", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#ir-agent", keywords: ["ir agent", "johnny", "investor relations agent", "agent controls"], workspace: "admin", section: true },
  { id: "sec-stage-menu", title: "Stage menu", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#stage-menu", keywords: ["stage menu", "founder stages", "menu editor", "stages"], workspace: "admin", section: true },
  { id: "sec-founder-social", title: "Founder social controls", subtitle: "Administration › Feature Controls", href: "/admin/feature-controls#founder-social", keywords: ["founder social", "social limits", "post limits", "social media limits"], workspace: "admin", section: true },
];

// ── Admin categories: one icon and color each ─────────────────────────────────

type CatKey =
  | "dashboard" | "contacts" | "companies" | "sales" | "marketing" | "ir" | "directory"
  | "accounting" | "social" | "events" | "voice" | "communication" | "support"
  | "learning" | "admin" | "system" | "analytics"
  | "onboarding" | "preparation" | "closing" | "documents" | "investors"
  | "market" | "matches" | "portfolio" | "actions" | "profile" | "settings";

const CATS: Record<CatKey, { label: string; bg: string; fg: string; icon: ReactNode }> = {
  dashboard: { label: "Dashboard", bg: "#D1D5DB", fg: "#1F2937", icon: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></> },
  contacts: { label: "Contacts", bg: "#DCE8FD", fg: "#1D5FD6", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></> },
  companies: { label: "Companies", bg: "#D5F2EE", fg: "#0F766E", icon: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></> },
  sales: { label: "Sales", bg: "#DAF2DF", fg: "#15803D", icon: <><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></> },
  marketing: { label: "Marketing", bg: "#FDE2E0", fg: "#B42318", icon: <><path d="M3 11v2a1 1 0 0 0 1 1h3l8 5V5L7 10H4a1 1 0 0 0-1 1z" /><path d="M19 9a4 4 0 0 1 0 6" /></> },
  ir: { label: "Investor Relations", bg: "#E6E3FB", fg: "#4F46E5", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.5 4 6" /></> },
  directory: { label: "Investor Directory", bg: "#E0F2FE", fg: "#0369A1", icon: <><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M4 16a4 4 0 0 1 4-4h10" /></> },
  accounting: { label: "Accounting", bg: "#FEF3C7", fg: "#A16207", icon: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2" /></> },
  social: { label: "Social Media", bg: "#FAE8FF", fg: "#A21CAF", icon: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" /></> },
  events: { label: "Events", bg: "#FFEBD5", fg: "#C2410C", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  voice: { label: "Voice", bg: "#ECFCCB", fg: "#4D7C0F", icon: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></> },
  communication: { label: "Communication", bg: "#CFFAFE", fg: "#0E7490", icon: <path d="M4 5h16v11H9l-5 4z" /> },
  support: { label: "Customer Support", bg: "#FCE7F3", fg: "#BE185D", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></> },
  learning: { label: "Learning", bg: "#E7E5E4", fg: "#57534E", icon: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" /></> },
  admin: { label: "Administration", bg: "#E2E8F0", fg: "#334155", icon: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></> },
  system: { label: "System", bg: "#D1D5DB", fg: "#1F2937", icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
  analytics: { label: "Analytics", bg: "#DBEAFE", fg: "#1E40AF", icon: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> },
  // Founder and investor
  onboarding: { label: "Onboarding", bg: "#DCE8FD", fg: "#1D5FD6", icon: <path d="M5 21V4M5 4h11l-2 4 2 4H5" /> },
  preparation: { label: "Preparation", bg: "#FEF3C7", fg: "#A16207", icon: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></> },
  closing: { label: "Closing", bg: "#DAF2DF", fg: "#15803D", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></> },
  documents: { label: "Documents", bg: "#E0F2FE", fg: "#0369A1", icon: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></> },
  investors: { label: "Investors", bg: "#E6E3FB", fg: "#4F46E5", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.5 4 6" /></> },
  market: { label: "Private Market", bg: "#DAF2DF", fg: "#15803D", icon: <><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></> },
  matches: { label: "Matches", bg: "#E6E3FB", fg: "#4F46E5", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  portfolio: { label: "Portfolio", bg: "#FEF3C7", fg: "#A16207", icon: <><path d="M12 3v9h9" /><path d="M20 15a9 9 0 1 1-11-11" /></> },
  actions: { label: "Action Center", bg: "#FCE7F3", fg: "#BE185D", icon: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /> },
  profile: { label: "Profile", bg: "#DCE8FD", fg: "#1D5FD6", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></> },
  settings: { label: "Settings", bg: "#D1D5DB", fg: "#1F2937", icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
};

// Names shown in breadcrumbs, per workspace (falls back to the category label).
const LABELS: Partial<Record<WorkspaceId, Partial<Record<CatKey, string>>>> = {
  founder: {
    onboarding: "Stage 1 · Onboarding",
    preparation: "Stage 2 · Preparation",
    marketing: "Stage 3 · Marketing",
    closing: "Stage 4 · Closing",
    communication: "Communications",
  },
  investor: { communication: "Communications" },
};
function labelOf(ws: WorkspaceId, cat: CatKey): string {
  return LABELS[ws]?.[cat] ?? CATS[cat].label;
}

// "Jump to" tiles and quick actions on the empty state, per workspace.
type Hub = { cat: CatKey; href: string; label?: string };

const HUBS: Record<WorkspaceId, Hub[]> = {
  admin: [
    { cat: "dashboard", href: "/admin" },
    { cat: "contacts", href: "/admin/contacts" },
    { cat: "sales", href: "/admin/sales" },
    { cat: "marketing", href: "/admin/marketing" },
    { cat: "ir", href: "/admin/ir" },
    { cat: "directory", href: "/admin/investor-directory" },
    { cat: "accounting", href: "/admin/accounting" },
    { cat: "social", href: "/admin/social" },
    { cat: "events", href: "/admin/events" },
    { cat: "voice", href: "/admin/voice" },
    { cat: "communication", href: "/admin/inbox" },
    { cat: "support", href: "/admin/companies" },
    { cat: "learning", href: "/admin/learning" },
    { cat: "analytics", href: "/admin/analytics" },
    { cat: "admin", href: "/admin/users/manage" },
    { cat: "system", href: "/admin/integrations" },
  ],
  founder: [
    { cat: "dashboard", href: "/founder" },
    { cat: "onboarding", href: "/founder/onboarding", label: "1 · Onboarding" },
    { cat: "preparation", href: "/founder/readiness", label: "2 · Preparation" },
    { cat: "marketing", href: "/founder/investors", label: "3 · Marketing" },
    { cat: "closing", href: "/founder/deal-room", label: "4 · Closing" },
    { cat: "communication", href: "/founder/inbox", label: "Communications" },
    { cat: "events", href: "/founder/events" },
    { cat: "learning", href: "/founder/learning" },
    { cat: "settings", href: "/founder/settings" },
  ],
  investor: [
    { cat: "dashboard", href: "/investor/dashboard" },
    { cat: "profile", href: "/investor/onboarding" },
    { cat: "market", href: "/investor/opportunities" },
    { cat: "matches", href: "/investor/matches" },
    { cat: "portfolio", href: "/investor/portfolio" },
    { cat: "actions", href: "/investor/actions" },
    { cat: "communication", href: "/investor/inbox", label: "Communications" },
    { cat: "learning", href: "/investor/learning" },
    { cat: "analytics", href: "/investor/analytics" },
    { cat: "settings", href: "/investor/settings" },
  ],
};

// Quick actions: where a "New ..." page exists it opens that; the others open
// the page where the add button lives.
const QUICK: Record<WorkspaceId, Array<{ title: string; href: string }>> = {
  admin: [
    { title: "New invoice", href: "/admin/accounting/invoices/new" },
    { title: "Add contact", href: "/admin/contacts" },
    { title: "Add opportunity", href: "/admin/sales/opportunities" },
    { title: "Add task", href: "/admin/tasks" },
  ],
  founder: [
    { title: "Upload document", href: "/founder/documents" },
    { title: "Add investor contact", href: "/founder/contacts" },
    { title: "Open Deal Room", href: "/founder/deal-room" },
  ],
  investor: [
    { title: "Browse opportunities", href: "/investor/opportunities" },
    { title: "Open watchlist", href: "/investor/watchlist" },
    { title: "Schedule a meeting", href: "/investor/schedule" },
  ],
};

function catOfFounder(p: string): CatKey {
  const starts = (...xs: string[]) => xs.some((x) => p === x || p.startsWith(`${x}/`));
  if (p === "/founder/stages/onboarding" || starts("/founder/onboarding")) return "onboarding";
  if (p === "/founder/stages/preparation") return "preparation";
  if (p === "/founder/stages/marketing") return "marketing";
  if (p === "/founder/stages/closing") return "closing";
  if (starts("/founder/events/present")) return "marketing";
  if (starts("/founder/readiness", "/founder/documents", "/founder/preview", "/founder/business-plan", "/founder/pitch-deck", "/founder/pitch-deck-analyzer", "/founder/market-claim", "/founder/financial-model", "/founder/cap-table", "/founder/valuation", "/founder/reg-cf", "/founder/report", "/founder/pitch-practice", "/founder/board-prep", "/founder/term-sheet", "/founder/kpi-glossary", "/founder/raise-toolkit")) return "preparation";
  if (starts("/founder/investors", "/founder/contacts", "/founder/matches", "/founder/matching", "/founder/deploy", "/founder/ir-agent", "/founder/investor-directory", "/founder/investor-pipeline", "/founder/private-market", "/founder/marketplace")) return "marketing";
  if (starts("/founder/deal-room", "/founder/offering-type", "/founder/spvs", "/founder/capital-raise", "/founder/investor-update", "/founder/milestones")) return "closing";
  if (starts("/founder/analytics")) return "analytics";
  if (starts("/founder/inbox", "/founder/messages", "/founder/updates", "/founder/investor-interest", "/founder/tasks", "/founder/help", "/founder/support")) return "communication";
  if (starts("/founder/calendar", "/founder/schedule", "/founder/events")) return "events";
  if (starts("/founder/learning")) return "learning";
  if (starts("/founder/settings")) return "settings";
  return "dashboard";
}

function catOfInvestor(p: string): CatKey {
  const starts = (...xs: string[]) => xs.some((x) => p === x || p.startsWith(`${x}/`));
  if (starts("/investor/onboarding", "/investor/verification")) return "profile";
  if (starts("/investor/opportunities", "/investor/watchlist", "/investor/interest-pipeline", "/investor/deal-room", "/investor/deals")) return "market";
  if (starts("/investor/matches", "/investor/matching", "/investor/partner-score")) return "matches";
  if (starts("/investor/portfolio", "/investor/spvs")) return "portfolio";
  if (starts("/investor/activity", "/investor/actions", "/investor/tasks")) return "actions";
  if (starts("/investor/inbox", "/investor/messages", "/investor/calendar", "/investor/schedule")) return "communication";
  if (starts("/investor/learning")) return "learning";
  if (starts("/investor/analytics")) return "analytics";
  if (starts("/investor/settings")) return "settings";
  return "dashboard";
}

function catOf(href: string): CatKey {
  const p = href.split("#")[0] ?? href;
  if (p === "/founder" || p.startsWith("/founder/")) return catOfFounder(p);
  if (p.startsWith("/investor")) return catOfInvestor(p);
  const starts = (...xs: string[]) => xs.some((x) => p === x || p.startsWith(`${x}/`));
  if (p === "/admin/investors/enrich") return "ir";
  if (starts("/admin/contacts")) return "contacts";
  if (starts("/admin/sales")) return "sales";
  if (starts("/admin/marketing")) return "marketing";
  if (starts("/admin/investor-directory")) return "directory";
  if (starts("/admin/accounting")) return "accounting";
  if (starts("/admin/social")) return "social";
  if (starts("/admin/events")) return "events";
  if (starts("/admin/voice")) return "voice";
  if (starts("/admin/inbox", "/admin/calendar", "/admin/schedule", "/admin/meet", "/admin/meetings", "/admin/signatures", "/admin/tasks")) return "communication";
  if (starts("/admin/companies", "/admin/investors", "/admin/support", "/admin/founders-stuck", "/admin/prospect-intros", "/admin/ai-usage")) return "support";
  if (starts("/admin/learning")) return "learning";
  if (starts("/admin/users", "/admin/billing", "/admin/pricing", "/admin/accounts", "/admin/profile", "/admin/profile-fields", "/admin/feature-controls", "/admin/crm/connectors")) return "admin";
  if (starts("/admin/integrations", "/admin/queues", "/admin/automation", "/admin/scheduled-jobs", "/admin/page-builder-lab", "/admin/system-health", "/admin/imports", "/admin/beta-operations")) return "system";
  if (starts("/admin/analytics", "/admin/funnels", "/admin/reports", "/admin/message-activity", "/admin/insights", "/admin/compliance", "/admin/audit", "/admin/report-compare")) return "analytics";
  if (starts("/admin/ir", "/admin/ir-funnel", "/admin/crm", "/admin/fit", "/admin/spvs", "/admin/matching", "/admin/outreach-qualification", "/admin/portfolio", "/admin/readiness", "/admin/marketplace", "/admin/partner-scores", "/admin/deal-rooms", "/admin/data-room", "/admin/diligence")) return "ir";
  return "dashboard";
}

function dynCat(type: SearchResult["type"]): CatKey {
  switch (type) {
    case "document": return "documents";
    case "investor": return "investors";
    case "deal_room": return "closing";
    case "company": return "companies";
    case "event": return "events";
    case "opportunity": return "sales";
    case "invoice": return "accounting";
    default: return "contacts";
  }
}

function CatChip({ cat, size = 28 }: { cat: CatKey; size?: number }) {
  const c = CATS[cat];
  return (
    <span style={{ width: size, height: size, borderRadius: 7, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill="none" stroke={c.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c.icon}</svg>
    </span>
  );
}

// Highlight the typed words inside a result title.
function hl(text: string, query: string): ReactNode {
  const words = query.split(/\s+/).filter((w) => w.length > 0).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;
  const re = new RegExp(`(${words.join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i} style={{ background: "#FFE9A8", color: "inherit", borderRadius: 3, padding: "0 1px" }}>{part}</mark> : part,
  );
}

// ── Recent items (per browser) ────────────────────────────────────────────────

const recentKey = (ws: WorkspaceId) => `icapos-${ws}-search-recent`;

type RecentItem = { title: string; subtitle: string | null; href: string; cat: CatKey };

function readRecents(ws: WorkspaceId, limit: number): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(recentKey(ws));
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(v)) return [];
    return (v as RecentItem[]).filter((x) => x && typeof x.href === "string" && typeof x.title === "string" && x.cat in CATS).slice(0, limit);
  } catch {
    return [];
  }
}

function saveRecent(ws: WorkspaceId, item: RecentItem) {
  try {
    const next = [item, ...readRecents(ws, 8).filter((x) => x.href !== item.href)].slice(0, 8);
    window.localStorage.setItem(recentKey(ws), JSON.stringify(next));
  } catch {
    // Storage can be blocked; recents are a convenience only.
  }
}

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  contact: "Contacts",
  investor: "Pipeline investors",
  document: "Documents",
  deal_room: "Deal rooms",
  company: "Companies",
  event: "Events",
  opportunity: "Deals",
  invoice: "Invoices",
};

// ── Main modal ────────────────────────────────────────────────────────────────

type Props = { workspace?: WorkspaceId };

type Combined = { href: string; meta?: RecentItem; ask?: boolean };

// Menu pages are searched from the live navigation, so every workspace (admin
// included) finds its pages without a hand kept list.
const ROOT_LABEL: Record<WorkspaceId, string> = { founder: "Founder", investor: "Investor", admin: "Admin" };

function navSectionsFor(workspace: WorkspaceId) {
  if (workspace === "admin") return getAdminWorkspaceNavSections();
  if (workspace === "investor") return getInvestorWorkspaceNavSections();
  return getFounderWorkspaceNavSections();
}

const SECTION_LABEL: React.CSSProperties = { padding: "10px 18px 4px", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".08em" };

export function GlobalSearchModal({ workspace = "founder" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicResults, setDynamicResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hubs = HUBS[workspace];
  const quick = QUICK[workspace];
  const menuIndex = useMemo(() => buildSearchIndex(navSectionsFor(workspace), ROOT_LABEL[workspace]), [workspace]);

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

  // Debounced API search (founder and admin; investors search pages only)
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
  const q = query.toLowerCase().trim();
  const workspacePages = PAGES.filter((p) => p.workspace === workspace || p.workspace === "all");

  // Ranking: every word must match; exact phrases, titles and keywords
  // score higher, so "ai budget" lands on the AI budget section first.
  function scorePage(p: PageShortcut): number {
    const title = p.title.toLowerCase();
    const sub = p.subtitle.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    let score = 0;
    for (const w of words) {
      let best = 0;
      if (title.startsWith(w) || title.includes(` ${w}`)) best = 30;
      else if (title.includes(w)) best = 20;
      if (p.keywords.some((k) => k === w)) best = Math.max(best, 25);
      else if (p.keywords.some((k) => k.includes(w))) best = Math.max(best, 15);
      if (sub.includes(w)) best = Math.max(best, 5);
      if (best === 0) return 0;
      score += best;
    }
    if (title === q) score += 100;
    else if (title.includes(q)) score += 40;
    if (p.keywords.some((k) => k.includes(q))) score += 60;
    if (p.section) score += 5;
    return score;
  }

  const emptyState = query.length === 0;
  const shortcutHits: PageShortcut[] = emptyState
    ? []
    : workspacePages
        .map((p) => ({ p, s: scorePage(p) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map((x) => x.p);
  // Then the live menu, word by word with synonyms ("website setting" finds Feature Controls),
  // for pages the shortcuts above did not already return.
  const matchedPages: PageShortcut[] = emptyState
    ? []
    : [
        ...shortcutHits,
        ...searchMenu(menuIndex, query, 6)
          .filter((h) => !shortcutHits.some((p) => p.href === h.href))
          .map((h): PageShortcut => ({ id: `menu:${h.href}`, title: h.label, subtitle: h.path, href: h.href, keywords: [], workspace, path: h.path, reason: h.reason })),
      ].slice(0, 8);

  function crumbOf(p: PageShortcut): string {
    if (p.path) return p.path;
    return p.section ? p.subtitle : `${labelOf(workspace, catOf(p.href))} › ${p.title}`;
  }

  // Empty state: recent items, quick actions, jump to tiles
  const recents: RecentItem[] = emptyState && open ? readRecents(workspace, 4) : [];

  // Group dynamic results by type
  const grouped = new Map<SearchResult["type"], SearchResult[]>();
  for (const r of dynamicResults) {
    const arr = grouped.get(r.type) ?? [];
    arr.push(r);
    grouped.set(r.type, arr);
  }

  // Flat combined list for keyboard nav index
  const combined: Combined[] = emptyState
    ? [
        ...recents.map((r) => ({ href: r.href, meta: r })),
        ...quick.map((c) => ({ href: c.href })),
        ...hubs.map((h) => ({ href: h.href, meta: { title: h.label ?? labelOf(workspace, h.cat), subtitle: null, href: h.href, cat: h.cat } })),
      ]
    : [
        ...matchedPages.map((p) => ({
          href: p.href,
          meta: { title: p.title, subtitle: crumbOf(p), href: p.href, cat: catOf(p.href) },
        })),
        ...dynamicResults.map((r) => ({
          href: r.href,
          meta: { title: r.title, subtitle: r.subtitle, href: r.href, cat: dynCat(r.type) },
        })),
        ...(query.length >= 2 ? [{ href: "", ask: true }] : []),
      ];
  const askIndex = !emptyState && query.length >= 2 ? combined.length - 1 : -1;
  const hasResults = matchedPages.length + dynamicResults.length > 0;

  /** Hand the question to the iCapOS Assistant, which knows the whole menu. */
  function askAssistant() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("icapos-assistant:ask", { detail: { prompt: `Where do I find "${query}" in the menu? Point me to the page.` } }));
  }

  function navigate(href: string, meta?: RecentItem) {
    if (meta) saveRecent(workspace, meta);
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
      if (item?.ask) askAssistant();
      else if (item) navigate(item.href, item.meta);
    }
  }

  if (!open) return null;

  const rowBase: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "10px 18px", border: "none", cursor: "pointer", textAlign: "left",
    transition: "background 0.1s",
  };
  const activeBg = "#EAF1FE";
  const pill: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: "3px 8px", flexShrink: 0 };

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
          width: "min(640px, calc(100vw - 24px))",
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
        <div style={{ maxHeight: 520, overflowY: "auto" }}>

          {/* Empty query with no results */}
          {!hasResults && query.length >= 2 && !loading && (
            <p style={{ padding: "24px 18px 8px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              No results for &ldquo;{query}&rdquo;. Try fewer or different words, or ask below.
            </p>
          )}

          {/* Empty state */}
          {emptyState && (
            <div>
              {recents.length > 0 && (
                <div>
                  <p style={SECTION_LABEL}>Recent</p>
                  {recents.map((r, i) => (
                    <button
                      key={r.href}
                      type="button"
                      onClick={() => navigate(r.href, r)}
                      onMouseEnter={() => setActiveIndex(i)}
                      style={{ ...rowBase, background: i === activeIndex ? activeBg : "transparent" }}
                    >
                      <CatChip cat={r.cat} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.title}</span>
                        {r.subtitle && <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{r.subtitle}</span>}
                      </span>
                      {i === activeIndex && <kbd style={{ fontSize: 10, color: "#6b7280", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>↵</kbd>}
                    </button>
                  ))}
                </div>
              )}

              <p style={SECTION_LABEL}>{workspace === "admin" ? "Create" : "Quick actions"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 18px 4px" }}>
                {quick.map((c, j) => {
                  const idx = recents.length + j;
                  const on = idx === activeIndex;
                  return (
                    <button
                      key={c.title}
                      type="button"
                      onClick={() => navigate(c.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#1D5FD6", background: on ? "#EAF1FE" : "white", border: "1px solid #BCD3F8", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D5FD6" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                      {c.title}
                    </button>
                  );
                })}
              </div>

              <p style={{ ...SECTION_LABEL, paddingTop: 14 }}>Jump to</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: "0 18px 14px" }}>
                {hubs.map((h, k) => {
                  const idx = recents.length + quick.length + k;
                  const on = idx === activeIndex;
                  return (
                    <button
                      key={h.href}
                      type="button"
                      onClick={() => navigate(h.href, { title: h.label ?? labelOf(workspace, h.cat), subtitle: null, href: h.href, cat: h.cat })}
                      onMouseEnter={() => setActiveIndex(idx)}
                      style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${on ? "#BCD3F8" : "#eef0f4"}`, background: on ? "#EAF1FE" : "white", borderRadius: 10, padding: "7px 9px", fontSize: 12.5, fontWeight: 600, color: "#111827", cursor: "pointer", textAlign: "left" }}
                    >
                      <CatChip cat={h.cat} size={26} />
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.label ?? labelOf(workspace, h.cat)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Page shortcuts */}
          {matchedPages.length > 0 && (
            <div>
              {matchedPages.map((page, i) => {
                const isActive = i === activeIndex;
                const cat = catOf(page.href);
                return (
                  <div key={page.id}>
                    {i === 0 && <p style={SECTION_LABEL}>Best match</p>}
                    {i === 1 && <p style={SECTION_LABEL}>More matches</p>}
                    <button
                      type="button"
                      onClick={() => navigate(page.href, { title: page.title, subtitle: crumbOf(page), href: page.href, cat })}
                      style={{ ...rowBase, background: isActive ? activeBg : "transparent" }}
                      onMouseEnter={() => setActiveIndex(i)}
                    >
                      <CatChip cat={cat} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{hl(page.title, query)}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{crumbOf(page)}</span>
                      </span>
                      <span style={{ ...pill, color: page.section && i === 0 ? "#1D5FD6" : "#475569", background: page.section && i === 0 ? "#DCE8FD" : "#EEF1F5" }}>
                        {page.reason ?? (page.section ? (i === 0 ? "Jumps to section" : "Section") : "Page")}
                      </span>
                      {isActive && (
                        <kbd style={{ fontSize: 10, color: "#6b7280", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>↵</kbd>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic results, grouped by type */}
          {[...grouped.entries()].map(([type, rows]) => {
            const sectionStart = matchedPages.length + dynamicResults.indexOf(rows[0]!);
            return (
              <div key={type} style={{ borderTop: "1px solid #f3f4f6" }}>
                <p style={SECTION_LABEL}>
                  {TYPE_LABELS[type]}
                </p>
                {rows.map((r, i) => {
                  const idx = sectionStart + i;
                  const isActive = idx === activeIndex;
                  const email = "email" in r ? r.email : null;
                  const meta: RecentItem = { title: r.title, subtitle: r.subtitle, href: r.href, cat: dynCat(r.type) };
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", background: isActive ? activeBg : "transparent", transition: "background 0.1s" }} onMouseEnter={() => setActiveIndex(idx)}>
                      <button
                        type="button"
                        onClick={() => navigate(r.href, meta)}
                        style={{ ...rowBase, flex: 1, width: "auto", minWidth: 0, background: "transparent" }}
                      >
                        <CatChip cat={dynCat(r.type)} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hl(r.title, query)}</span>
                          {r.subtitle && <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{hl(r.subtitle, query)}</span>}
                        </span>
                      </button>
                      {isActive && email && (
                        <a
                          href={`mailto:${email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 11, fontWeight: 600, color: "#1D5FD6", background: "white", border: "1px solid #BCD3F8", borderRadius: 6, padding: "4px 8px", textDecoration: "none", marginRight: 8, flexShrink: 0 }}
                        >
                          Email
                        </a>
                      )}
                      {isActive && (
                        <kbd style={{ fontSize: 10, color: "#6b7280", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", marginRight: 18, flexShrink: 0 }}>↵</kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Ask the assistant */}
          {askIndex >= 0 && (
            <div style={{ borderTop: "1px solid #f3f4f6" }}>
              <p style={SECTION_LABEL}>Not what you meant?</p>
              <button
                type="button"
                onClick={askAssistant}
                onMouseEnter={() => setActiveIndex(askIndex)}
                style={{ ...rowBase, background: activeIndex === askIndex ? activeBg : "transparent" }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 7, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#6b7280", fontSize: 14, fontWeight: 700 }}>?</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>Ask what you are looking for</span>
                  <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>The iCapOS Assistant will point you to the right page</span>
                </span>
                {activeIndex === askIndex && (
                  <kbd style={{ fontSize: 10, color: "#6b7280", background: "white", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>↵</kbd>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 12, background: "#fafafa" }}>
          {([["↑↓", "navigate"], ["↵", "open"], ["esc", "close"]] as [string, string][]).map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b7280" }}>
              <kbd style={{ fontSize: 10, background: "#e5e7eb", borderRadius: 3, padding: "1px 5px", fontFamily: "inherit" }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
