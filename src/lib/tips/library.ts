import type { JourneyStage } from "@/lib/founder-journey/types";

export type TipAudience = "founder" | "investor";

/** Investor context buckets derived from the Partner Score. */
export type InvestorTipState = "new" | "low_responsiveness" | "low_followthrough" | "general";

export type Tip = {
  id: string;
  audience: TipAudience;
  /** Short chip label explaining why this tip is shown. */
  context: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  /** Founder tips may target a specific journey stage; omit for general. */
  founderStage?: JourneyStage;
  /** Investor tips may target a specific state; omit for general. */
  investorState?: InvestorTipState;
  /** Founder menu tips: shown once the founder has reached this stage (matches the menu's own lock). */
  minStage?: JourneyStage;
};

/**
 * One tip per founder menu destination. The coverage test in
 * library.coverage.test.ts fails when a page is added to the founder menu
 * without a tip here, so tips cannot silently fall behind the product.
 */
function menuTip(slug: string, href: string, label: string, body: string, minStage?: JourneyStage): Tip {
  return {
    id: `f-menu-${slug}`,
    audience: "founder",
    context: label,
    body,
    actionLabel: `Open ${label}`,
    actionHref: href,
    ...(minStage ? { minStage } : {}),
  };
}

const FOUNDER_MENU_TIPS: Tip[] = [
  // My raise
  menuTip("journey", "/founder/journey", "My Progress", "See which stage you are in and what is still left before the next one."),
  menuTip("actions", "/founder/actions", "Action Center", "Your open next steps are collected here, so you can work down one list instead of searching the menu."),
  menuTip("outreach-report", "/founder/outreach-report", "Outreach report", "Review what has gone out to investors and what came back, so you know who to follow up with."),
  menuTip("preview", "/founder/preview", "One pager", "Keep your one pager current. It is the shortest version of your story that you can share."),
  // Readiness
  menuTip("readiness", "/founder/readiness", "Readiness checklist", "Work through the readiness checklist to see exactly which items are holding back your score.", "qualify"),
  menuTip("data-room", "/founder/readiness/data-room", "Data room", "Organize your data room now. Investors ask for the same core files in diligence, and having them ready saves days.", "qualify"),
  menuTip("wizard", "/founder/readiness/wizard", "Capital Readiness Rating", "The score wizard walks you through your Capital Readiness Rating. Run it again after major changes to see how your score moves.", "qualify"),
  menuTip("diligence", "/founder/readiness/diligence", "Diligence and review", "Run the diligence and review step before investors do. Fixing gaps yourself is cheaper than explaining them later.", "deploy"),
  menuTip("document-checklist", "/founder/readiness/documents", "Document checklist", "Use the document checklist to confirm each required file is uploaded before you reach out to investors.", "deploy"),
  menuTip("ai-report", "/founder/report", "AI diligence report", "The AI diligence report shows how your company may look to an investor reviewing it. Read it before outreach.", "deploy"),
  menuTip("documents", "/founder/documents", "Documents", "Upload and keep current the documents your readiness score depends on, starting with your cap table.", "qualify"),
  // Materials
  menuTip("business-plan", "/founder/business-plan", "Business plan", "Your business plan is a core readiness document. Keep it consistent with your pitch deck and financial model.", "qualify"),
  menuTip("pitch-deck", "/founder/pitch-deck", "Pitch deck", "Build or update your pitch deck here, then run it through the Pitch deck analyzer for feedback.", "qualify"),
  menuTip("financial-model", "/founder/financial-model", "Financial model", "Keep your financial model in sync with your business plan, since investors compare the two.", "qualify"),
  menuTip("cap-table", "/founder/cap-table", "Cap table", "A clean cap table is one of the first things an investor asks to see. Update it after every issuance.", "qualify"),
  menuTip("valuation", "/founder/valuation", "Valuation Studio", "Use Valuation Studio to test a valuation range before you discuss terms with investors.", "qualify"),
  menuTip("market-claim", "/founder/market-claim", "Market claim grader", "Test your market size claim with the Market claim grader before an investor challenges it.", "qualify"),
  // Prepare
  menuTip("pitch-practice", "/founder/pitch-practice", "Pitch practice", "Rehearse your pitch in Pitch practice before real investor meetings.", "qualify"),
  menuTip("pitch-deck-analyzer", "/founder/pitch-deck-analyzer", "Pitch deck analyzer", "Upload your deck to the Pitch deck analyzer to find weak slides before investors do.", "qualify"),
  menuTip("board-prep", "/founder/board-prep", "Board meeting prep", "Board meeting prep helps you organize materials and talking points ahead of each meeting.", "qualify"),
  menuTip("term-sheet", "/founder/term-sheet", "Term sheet explainer", "Read a term sheet in plain language with the Term sheet explainer before you respond to one.", "qualify"),
  menuTip("kpi-glossary", "/founder/kpi-glossary", "KPI glossary", "Unsure what a metric means? The KPI glossary defines the terms investors use.", "qualify"),
  // Investors
  menuTip("contacts", "/founder/contacts", "My contacts", "Keep My contacts up to date. It holds the people you plan to reach out to.", "deploy"),
  menuTip("matches", "/founder/matches", "Investor matches", "Review your Investor matches regularly. New matches are the shortest path to a first conversation.", "deploy"),
  menuTip("investors", "/founder/investors", "Investors", "Use Investors to see everyone you are working with in one place.", "deploy"),
  menuTip("investor-directory", "/founder/investor-directory", "Investor directory", "Browse the investor directory to find investors whose focus fits your sector and stage.", "deploy"),
  menuTip("ir-agent", "/founder/ir-agent", "My IR Agent", "Use My IR Agent for help with investor relations work during your raise.", "deploy"),
  menuTip("social", "/founder/deploy/social", "Social media", "Use Social media under Outreach to support your raise beyond email.", "deploy"),
  menuTip("pipeline", "/founder/investor-pipeline", "Investor CRM", "Update the Investor CRM after every conversation so your pipeline always shows the real status.", "deploy"),
  menuTip("investor-interest", "/founder/investor-interest", "Investor interest", "Investor interest shows who has responded to your company. Follow up while the interest is fresh."),
  menuTip("events", "/events", "Events", "Check Events for upcoming sessions you can attend.", "qualify"),
  menuTip("founder-events", "/founder/events", "Events", "Check Events for upcoming sessions you can attend.", "qualify"),
  menuTip("events-present", "/founder/events/present", "Present at event", "Use Present at event to put your company in front of an audience.", "deploy"),
  // Closing
  menuTip("deal-room", "/founder/deal-room", "Deal Room", "Use the Deal Room to share deal materials with interested investors in one place.", "deploy"),
  menuTip("offering-type", "/founder/offering-type", "Offering type", "Choose your offering type early, since it shapes the documents and rules that apply to your raise.", "deploy"),
  menuTip("spvs", "/founder/spvs", "SPVs and closings", "Use SPVs and closings to manage the entities and steps involved in closing a round."),
  menuTip("investor-update", "/founder/investor-update", "Investor update builder", "Use the Investor update builder to draft a clear update, and send one on a regular cadence.", "deploy"),
  // Communicate
  menuTip("inbox", "/founder/inbox", "Inbox", "Check your Inbox daily so no investor reply goes cold."),
  menuTip("messages", "/founder/messages", "Messages", "Reply to investor Messages quickly. A fast response keeps momentum.", "deploy"),
  menuTip("updates", "/founder/updates", "Investor Updates", "Use Investor Updates to keep investors informed between conversations.", "deploy"),
  menuTip("calendar", "/founder/calendar", "Calendar", "Keep your Calendar current so meetings and deadlines are visible in one place."),
  menuTip("schedule", "/founder/schedule", "Scheduling", "Use Scheduling to let people book time with you instead of trading emails."),
  menuTip("tasks", "/founder/tasks", "Tasks", "Capture follow ups in Tasks so nothing with an investor slips.", "qualify"),
  menuTip("notifications", "/notifications", "Notifications", "Notifications flag activity that needs you. Clear them regularly.", "qualify"),
  menuTip("help", "/founder/help", "How it works", "Not sure what comes next? How it works explains the steps of the platform."),
  menuTip("support", "/founder/support", "Support", "Stuck on something? Support is in the menu whenever you need help."),
  // Learning
  menuTip("learning-courses", "/founder/learning/courses", "Browse courses", "Browse courses to pick up topics relevant to your current stage.", "qualify"),
  menuTip("learning-plan", "/founder/learning/plan", "My learning plan", "My learning plan lays out which modules to take and in what order.", "qualify"),
  menuTip("learning-schedule", "/founder/learning/schedule", "My Schedule", "Block time in My Schedule so your learning actually happens.", "qualify"),
  menuTip("learning-progress", "/founder/learning/progress", "My progress", "Check My progress to see completed modules and what is next.", "qualify"),
  menuTip("learning-stage-0", "/founder/learning/stages/stage_0", "Stage 0 Foundation", "Stage 0 Foundation covers the basics to put in place before you raise.", "qualify"),
  menuTip("learning-stage-1", "/founder/learning/stages/stage_1", "Stage 1 Seed Round", "Stage 1 Seed Round collects the lessons for preparing a seed round.", "qualify"),
  menuTip("learning-stage-2", "/founder/learning/stages/stage_2", "Stage 2 Series A", "Stage 2 Series A collects the lessons for preparing a Series A.", "qualify"),
  menuTip("learning-stage-3", "/founder/learning/stages/stage_3", "Stage 3 Exit", "Stage 3 Exit collects the lessons for planning an exit.", "qualify"),
  // After the raise
  menuTip("milestones", "/founder/milestones", "Milestones", "Track Milestones so investors can see steady progress after you close.", "optimize"),
  menuTip("analytics", "/founder/analytics", "Analytics", "Check Analytics to see how your raise is performing.", "optimize"),
  // Account
  menuTip("credits", "/credits", "iCFO Points", "Open iCFO Points to see your balance and what it can be used for."),
  menuTip("settings", "/founder/settings", "Company profile", "Keep your Company profile complete. It feeds your readiness score and what investors see."),
  menuTip("settings-team", "/founder/settings/team", "Team", "Add teammates under Team so they can help with the raise."),
  menuTip("settings-billing", "/founder/settings/billing", "Billing and subscription", "Review Billing and subscription to see what your plan includes."),
  menuTip("settings-integrations", "/founder/settings/integrations", "Integrations", "Use Integrations to connect the accounts your raise depends on."),
  menuTip("settings-feedback", "/founder/settings/feedback", "Feedback", "Use Feedback to tell the team what to improve."),
];

export const TIPS: Tip[] = [
  // ── Founder ─────────────────────────────────────────────────────────────
  {
    id: "f-initialize-profile",
    audience: "founder",
    context: "Initialize",
    founderStage: "initialize",
    body: "Complete every field in your company profile — it advances you automatically to Qualify, no review needed.",
    actionLabel: "Finish your profile",
    actionHref: "/founder/onboarding",
  },
  {
    id: "f-qualify-captable",
    audience: "founder",
    context: "Qualify",
    founderStage: "qualify",
    body: "Your cap table is one of three required documents. Uploading it is often the fastest step toward the 75% readiness threshold.",
    actionLabel: "Open Qualify",
    actionHref: "/founder/qualify",
  },
  {
    id: "f-deploy-warm",
    audience: "founder",
    context: "Deploy",
    founderStage: "deploy",
    body: "Investors who hear back the same week convert far better. Check your pipeline for anyone who's gone quiet and follow up.",
    actionLabel: "Open Deploy",
    actionHref: "/founder/deploy",
  },
  {
    id: "f-optimize-update",
    audience: "founder",
    context: "Optimize",
    founderStage: "optimize",
    body: "Committed investors expect a steady cadence. A short monthly update keeps momentum and signals a well-run raise.",
    actionLabel: "Send an update",
    actionHref: "/founder/capital-raise",
  },
  {
    id: "f-general-learning",
    audience: "founder",
    context: "Tip",
    minStage: "qualify",
    body: "The learning modules are tailored to your current stage — a few minutes there often unblocks your next step.",
    actionLabel: "Browse learning",
    actionHref: "/founder/learning",
  },

  ...FOUNDER_MENU_TIPS,

  // ── Investor ────────────────────────────────────────────────────────────
  {
    id: "i-new-engage",
    audience: "investor",
    context: "Partner Score",
    investorState: "new",
    body: "Engage at least 3 founders to unlock your Partner Score. Browsing dealflow and opening conversations starts your track record.",
    actionLabel: "Browse dealflow",
    actionHref: "/investor/opportunities",
  },
  {
    id: "i-respond-fast",
    audience: "investor",
    context: "Partner Score",
    investorState: "low_responsiveness",
    body: "Founders value a fast reply. Responding to waiting messages within a couple of days strengthens your responsiveness and Partner Score.",
    actionLabel: "Open messages",
    actionHref: "/investor/messages",
  },
  {
    id: "i-followthrough",
    audience: "investor",
    context: "Partner Score",
    investorState: "low_followthrough",
    body: "Following through on the deals you've saved or shown interest in is the biggest driver of your Partner Score.",
    actionLabel: "Review watchlist",
    actionHref: "/investor/watchlist",
  },
  {
    id: "i-general-profile",
    audience: "investor",
    context: "Tip",
    body: "A clear thesis, preferred sectors, and check-size range help founders understand your fit — and strengthen your credibility.",
    actionLabel: "Update profile",
    actionHref: "/investor/settings",
  },
];
