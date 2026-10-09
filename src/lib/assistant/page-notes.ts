/**
 * One line per founder, investor and shared page, telling the iCapOS Assistant
 * what the page is for. Founder pages that already have a Stage guide step
 * (src/lib/founder/stage-guides.ts) take their wording from there, so they are
 * not repeated here.
 *
 * The menu itself (names, paths, where a page sits, stage locks) is read live
 * from src/lib/workspace-nav.ts, so it never needs updating by hand. This file
 * only holds the short "what is it for" line. menu-knowledge.test.ts fails when
 * a founder or investor menu page has no line, so a new page cannot ship
 * without the assistant knowing about it.
 */
export const PAGE_NOTES: Record<string, string> = {
  // ── Founder ──────────────────────────────────────────────────────────────
  "/founder": "Dashboard: the founder's home page with progress, next steps and recent activity.",
  "/founder/onboarding": "Onboarding: the guided setup that links the company and fills the company profile.",
  "/founder/actions": "Action Center: the founder's prioritized list of next actions.",
  "/founder/stages/onboarding": "Stage guide for Stage 1 Onboarding: step by step what to do and where.",
  "/founder/stages/preparation": "Stage guide for Stage 2 Preparation: step by step what to do and where.",
  "/founder/stages/marketing": "Stage guide for Stage 3 Marketing: step by step what to do and where.",
  "/founder/stages/closing": "Stage guide for Stage 4 Closing: step by step what to do and where.",
  "/founder/readiness/wizard": "Capital Readiness Rating: the AI rating of how investable the company is right now, weighted for its stage. It is what opens introductions in Stage 3.",
  "/founder/documents": "Documents: upload and manage company documents (PDF only).",
  "/founder/readiness/diligence": "Diligence and review: the diligence review status of the founder's materials.",
  "/founder/readiness/documents": "Document checklist: which required documents are uploaded and which are missing.",
  "/founder/financial-model": "Financial model: driver based model (the founder sets assumptions, the tool does the math) with an investor ready Excel export. Counts toward readiness.",
  "/founder/cap-table": "Cap table: lay out shareholders, model a round to see dilution, export Excel or PDF. Counts toward readiness.",
  "/founder/valuation": "Valuation Studio: an indicative valuation range to prepare with, not a price and not an appraisal. Shows where methods disagree and returns modeled levers to improve the range.",
  "/founder/pitch-deck-analyzer": "Pitch deck analyzer: AI feedback on an existing pitch deck.",
  "/founder/market-claim": "Market claim grader: grades the market narrative the way the investor network reads it, then shows the objections reviewers raise and what clears them.",
  "/founder/pitch-practice": "Pitch practice: rehearse the pitch with an AI simulator.",
  "/founder/board-prep": "Board meeting prep: prepare materials and talking points for a board meeting.",
  "/founder/term-sheet": "Term sheet explainer: plain language explanations of term sheet terms (educational, not legal advice).",
  "/founder/kpi-glossary": "KPI glossary: definitions of the metrics investors ask about.",
  "/founder/reg-cf": "Reg CF materials: materials for founders running a Reg CF offering.",
  "/founder/matching": "Matching Center: investor contacts across the iCapOS network ranked by fit. Identities stay private until an introduction is made.",
  "/founder/contacts": "My contacts: the founder's own investors, imported, introduced by iCapOS, or added by hand.",
  "/founder/investor-directory": "Investor directory: public investor data, not the iCFO Capital investor network. Search, select and import investors into Manual outreach. Each plan includes directory contacts and Manual outreach emails per 30 days (Basic 500 and 1,000, Professional 10,000 and 20,000, Premium 20,000 and 40,000); top ups add more.",
  "/founder/investors": "Investors: the founder's investor overview.",
  "/founder/investors/matches": "Matches: investors matched to the company.",
  "/founder/investors/outreach": "Outreach (CRM): the founder's investor outreach records.",
  "/founder/outreach-report": "Outreach report: weekly and monthly summaries of the investor outreach the iCFO Capital team runs for the founder.",
  "/founder/private-market": "Marketplace: listing for Reg CF offerings only.",
  "/founder/marketplace/new": "List on marketplace: create a listing that links to the founder's registered funding portal (Reg CF only), reviewed before it goes live.",
  "/founder/capital-raise": "Capital Raise: plan and track the capital raise.",
  "/founder/events": "Events: iCFO investor events the founder can attend.",
  "/founder/investor-interest": "Investor interest: matched investors who viewed the deal or requested an introduction. Names show on Basic and up.",
  "/founder/inbox": "Inbox: the founder's email inbox inside iCapOS.",
  "/founder/messages": "Messages: conversations with investors on the platform.",
  "/founder/updates": "Investor Updates: updates sent to investors.",
  "/founder/calendar": "Calendar: the founder's meetings and events.",
  "/founder/schedule": "Scheduling: booking links and availability for meetings.",
  "/founder/tasks": "Tasks: the founder's to do list.",
  "/founder/help": "How it works: how iCapOS works from start to finish.",
  "/founder/support": "Support: ask the assistant, browse a guide, or reach the iCFO team.",
  "/founder/learning": "Learning: overview of founder courses and progress.",
  "/founder/learning/courses": "Browse courses: the founder course catalog.",
  "/founder/learning/plan": "My learning plan: the courses recommended for this founder.",
  "/founder/learning/schedule": "My schedule: planned learning sessions.",
  "/founder/learning/progress": "My progress: course completion.",
  "/founder/learning/stages/stage_0": "Learning track Stage 0 Foundation.",
  "/founder/learning/stages/stage_1": "Learning track Stage 1 Seed Round.",
  "/founder/learning/stages/stage_2": "Learning track Stage 2 Series A.",
  "/founder/learning/stages/stage_3": "Learning track Stage 3 Exit.",
  "/founder/settings/team": "Team: invite and manage team members.",
  "/founder/settings/billing": "Billing and subscription: current plan, upgrade or change plan, invoices.",
  "/founder/settings/integrations": "Integrations: connect outside tools such as Google Calendar.",
  "/founder/settings/feedback": "Feedback: send product feedback to the iCFO team.",

  // ── Investor ─────────────────────────────────────────────────────────────
  "/investor/dashboard": "Dashboard: the investor's home page.",
  "/investor/onboarding": "Profile: the investor profile and mandate (sectors, stages, check size) that drives matching.",
  "/investor/verification": "Identity and accreditation: verification required before deal access.",
  "/investor/opportunities": "Private Market: browse companies and request an introduction from a company profile.",
  "/investor/watchlist": "Watchlist: companies the investor saved.",
  "/investor/interest-pipeline": "Interest Pipeline: the investor's non binding indications of interest by stage.",
  "/investor/deal-room": "Deal Room: documents shared by companies the investor is in diligence with.",
  "/investor/deals": "Diligence: companies the investor is reviewing.",
  "/investor/matches": "Matches: fit scored founders, anonymized until both sides consent to an introduction.",
  "/investor/matching": "Matching Center: founder contacts across the iCapOS network ranked by fit with the investor's mandate, anonymized until both sides consent to an introduction.",
  "/investor/partner-score": "Partner Score: the investor's score on the platform.",
  "/investor/portfolio": "Portfolio: the investor's portfolio companies.",
  "/investor/spvs": "SPVs and closings: SPV participations and their requirements.",
  "/investor/activity": "Recent Activity: the investor's recent activity on the platform.",
  "/investor/actions": "Action Center: the investor's prioritized next actions.",
  "/investor/tasks": "Tasks: the investor's to do list.",
  "/investor/inbox": "Inbox: the investor's email inbox inside iCapOS.",
  "/investor/messages": "Messages: conversations with founders on the platform.",
  "/investor/calendar": "Calendar: the investor's meetings and events.",
  "/investor/schedule": "Scheduling: booking links and availability for meetings.",
  "/investor/learning": "Learning: investor courses.",
  "/investor/analytics": "Analytics: the investor's activity metrics.",
  "/investor/settings": "Settings: account and notification settings.",

  // ── Shared ───────────────────────────────────────────────────────────────
  "/events": "Events: iCFO investor event schedule.",
  "/credits": "iCFO Points: the points balance and how points are earned.",
  "/notifications": "Notifications: all in app notifications.",
};
