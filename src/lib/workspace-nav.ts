import type { InternalPermission } from "@/lib/rbac/constants";
import type { Role } from "@/lib/auth";
import type { JourneyStage } from "@/lib/founder-journey/types";

export type WorkspaceId = "founder" | "investor" | "admin";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  requiredPermission?: InternalPermission;
  minStage?: JourneyStage;
  children?: WorkspaceNavItem[];
};

export type WorkspaceNavSection = {
  title?: string;
  items: WorkspaceNavItem[];
};

export const adminWorkspaceNavSections: WorkspaceNavSection[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", requiredPermission: "view_admin_dashboard" },
      // Universal Contacts — one shared list for every department; each member sees the
      // contacts Lead-assigned to them (admins see all). No permission gate on purpose.
      { href: "/admin/sales/contacts", label: "Contacts" },
    ],
  },
  {
    title: "Executive",
    items: [
      { href: "/admin/ceo", label: "CEO Hub", requiredPermission: "view_admin_dashboard" },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        href: "/admin/sales",
        label: "Sales Hub",
        requiredPermission: "manage_crm",
        children: [
          { href: "/admin/sales",               label: "Dashboard"     },
          { href: "/admin/sales/opportunities", label: "Opportunities" },
          { href: "/admin/sales/pipeline",      label: "Pipeline"      },
          { href: "/admin/sales/settings",      label: "Settings"      },
        ],
      },
    ],
  },
  {
    title: "Directory",
    items: [
      { href: "/admin/companies",  label: "Companies",  requiredPermission: "manage_companies" },
      { href: "/admin/investors",  label: "Investors",  requiredPermission: "manage_investors" },
    ],
  },
  {
    title: "Investor Relations",
    items: [
      { href: "/admin/playbook", label: "Investor Relations Hub", requiredPermission: "view_admin_dashboard" },
      {
        href: "/admin/crm",
        label: "IR CRM",
        requiredPermission: "manage_crm",
        children: [
          { href: "/admin/crm",           label: "Activity"  },
          { href: "/admin/crm/pipeline",  label: "Pipeline"  },
          { href: "/admin/crm/messages",  label: "Messages"  },
          { href: "/admin/crm/outreach",  label: "Outreach"  },
        ],
      },
      { href: "/admin/crm/founders",     label: "Founder CRM",     requiredPermission: "manage_crm"         },
      { href: "/admin/crm/investors",    label: "Investor CRM",    requiredPermission: "manage_crm"         },
      { href: "/admin/crm/unclassified", label: "Unclassified",    requiredPermission: "manage_crm"         },
      { href: "/admin/intro-requests", label: "Intro Requests",  requiredPermission: "manage_matching"    },
      { href: "/admin/deal-rooms",     label: "Deal Rooms",      requiredPermission: "manage_deal_rooms" },
      { href: "/admin/spvs",           label: "SPVs",            requiredPermission: "manage_spvs"       },
      { href: "/admin/matching",       label: "Matching",        requiredPermission: "manage_matching"   },
      { href: "/admin/matching/prospects", label: "Prospect Investors", requiredPermission: "manage_matching" },
      { href: "/admin/matching/outreach", label: "Outreach Approvals", requiredPermission: "manage_matching" },
      { href: "/admin/partner-scores", label: "Partner Scores",  requiredPermission: "manage_investors"  },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        href: "/admin/marketing",
        label: "Marketing Hub",
        requiredPermission: "view_admin_dashboard",
        // Keep in sync with the marketing hub top-bar (src/app/admin/marketing/layout.tsx).
        children: [
          { href: "/admin/marketing",                     label: "Dashboard"    },
          { href: "/admin/marketing/console",             label: "Console"      },
          { href: "/admin/marketing/plan",                label: "Plan"         },
          { href: "/admin/marketing/contacts",            label: "Contacts"     },
          { href: "/admin/marketing/lists",               label: "Lists"        },
          { href: "/admin/marketing/campaigns",           label: "Campaigns"    },
          { href: "/admin/marketing/sequences",           label: "Sequences"    },
          { href: "/admin/marketing/templates",           label: "Templates"    },
          { href: "/admin/marketing/analytics",           label: "Analytics"    },
          { href: "/admin/marketing/aeo",                 label: "AEO"          },
          { href: "/admin/marketing/suppressions",        label: "Suppressions" },
          { href: "/admin/marketing/settings/notifications", label: "Settings"  },
        ],
      },
    ],
  },
  {
    title: "Events",
    items: [
      {
        href: "/admin/events",
        label: "Event Hub",
        requiredPermission: "view_events",
        children: [
          { href: "/admin/events",              label: "All events"   },
          { href: "/admin/events/applications", label: "Applications" },
          { href: "/admin/events/sponsors",     label: "Sponsors"     },
          { href: "/admin/events/analytics",    label: "Analytics"    },
          { href: "/admin/events/gamification", label: "Gamification" },
        ],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/actions",          label: "Action Center",   requiredPermission: "view_actions"         },
      { href: "/admin/tasks",            label: "Tasks",           requiredPermission: "view_admin_dashboard" },
      { href: "/admin/portfolio",        label: "Portfolio",       requiredPermission: "view_admin_dashboard" },
      { href: "/admin/readiness",        label: "Readiness Scores",requiredPermission: "manage_companies"    },
      { href: "/admin/data-room",         label: "Diligence Tracker",requiredPermission: "manage_companies"   },
      {
        href: "/admin/learning",
        label: "Learning",
        requiredPermission: "manage_learning",
        children: [
          { href: "/admin/learning",          label: "Overview"       },
          { href: "/admin/learning/courses",  label: "Courses"        },
          { href: "/admin/learning/founders", label: "Founder roster" },
        ],
      },
      { href: "/admin/manual",           label: "Operations Manual",requiredPermission: "view_admin_dashboard" },
    ],
  },
  {
    title: "Reports & Compliance",
    items: [
      {
        href: "/admin/analytics",
        label: "Analytics",
        requiredPermission: "view_analytics",
        children: [
          { href: "/admin/analytics", label: "Overview" },
          { href: "/admin/funnels",   label: "Activation funnels" },
          { href: "/admin/reports",   label: "Reports"   },
          { href: "/admin/insights",  label: "Insights"  },
        ],
      },
      {
        href: "/admin/compliance",
        label: "Compliance",
        requiredPermission: "manage_compliance",
        children: [
          { href: "/admin/compliance",             label: "Compliance"          },
          { href: "/admin/audit",                  label: "Audit"               },
          { href: "/admin/voice/consent-ledger",   label: "Voice Consent Ledger" },
          { href: "/admin/voice/campaigns",        label: "Voice Campaigns"      },
          { href: "/admin/voice/performance",      label: "Voice Performance"    },
          { href: "/admin/voice/calls",            label: "Voice Call Review"    },
        ],
      },
      { href: "/admin/diligence",         label: "Diligence Review", requiredPermission: "manage_diligence"     },
    ],
  },
  {
    title: "Documents & Comms",
    items: [
      {
        href: "/admin/meetings",
        label: "Meetings",
        requiredPermission: "view_admin_dashboard",
        children: [
          { href: "/admin/meetings",              label: "Meetings"        },
          { href: "/admin/meetings/kpi",          label: "KPI Dashboard"   },
          { href: "/admin/meetings/plan",         label: "Plan of Action"  },
          { href: "/admin/meetings/conferences",  label: "Events"          },
          { href: "/admin/meetings/onboarding",   label: "Client Onboarding" },
          { href: "/admin/meetings/campaigns",    label: "Campaigns & ROMI" },
        ],
      },
      { href: "/admin/inbox",     label: "Inbox",        requiredPermission: "view_admin_dashboard" },
      {
        href: "/admin/calendar",
        label: "Calendar",
        requiredPermission: "view_admin_dashboard",
        children: [
          { href: "/admin/calendar", label: "Calendar"   },
          { href: "/admin/schedule", label: "Scheduling" },
          { href: "/admin/meet",     label: "Meet"       },
        ],
      },
      { href: "/admin/signatures",        label: "E-Signatures",     requiredPermission: "review_documents"     },
    ],
  },
  {
    title: "Governance & System",
    items: [
      { href: "/admin/users/manage",      label: "User Management",  requiredPermission: "manage_users"        },
      { href: "/admin/users/permissions", label: "User Permissions", requiredPermission: "manage_users"        },
      { href: "/admin/feature-controls",  label: "Feature Controls", requiredPermission: "manage_settings"      },
      { href: "/admin/crm/connectors",    label: "Contact Sync",     requiredPermission: "manage_crm"          },
      { href: "/admin/billing",           label: "Billing",          requiredPermission: "manage_billing"      },
      { href: "/admin/profile",           label: "My Profile",       requiredPermission: "view_admin_dashboard" },
      {
        href: "/admin/integrations",
        label: "System",
        requiredPermission: "manage_integrations",
        children: [
          { href: "/admin/integrations",    label: "Integrations"    },
          { href: "/admin/queues",          label: "Queues"          },
          { href: "/admin/automation",      label: "Automation"      },
          { href: "/admin/page-builder-lab", label: "Page Builder"   },
          { href: "/admin/system-health",   label: "System Health"   },
          { href: "/admin/imports",         label: "Import / Export" },
          { href: "/admin/beta-operations", label: "Beta Operations" },
        ],
      },
    ],
  },
];

export const founderWorkspaceNavSections: WorkspaceNavSection[] = [
  {
    items: [
      { href: "/founder", label: "Dashboard" },
    ],
  },
  {
    title: "My raise",
    items: [
      { href: "/founder/journey", label: "My Journey" },
      { href: "/founder/command-center", label: "Command Center" },
      { href: "/founder/actions", label: "Action Center" },
      { href: "/founder/tasks", label: "Tasks", minStage: "qualify" },
    ],
  },
  {
    title: "Readiness",
    items: [
      {
        href: "/founder/readiness",
        label: "Readiness",
        minStage: "qualify",
        children: [
          { href: "/founder/readiness", label: "Checklist", minStage: "qualify" },
          { href: "/founder/readiness/data-room", label: "Data room", minStage: "qualify" },
          { href: "/founder/readiness/wizard", label: "Score wizard", minStage: "qualify" },
          { href: "/founder/readiness/diligence", label: "Diligence & review", minStage: "deploy" },
          { href: "/founder/readiness/documents", label: "Document checklist", minStage: "deploy" },
          { href: "/founder/report", label: "AI diligence report", minStage: "deploy" },
        ],
      },
      { href: "/founder/documents", label: "Documents", minStage: "qualify" },
    ],
  },
  {
    title: "Investors",
    items: [
      { href: "/founder/private-market", label: "Private Market", minStage: "qualify" },
      {
        href: "/founder/investors",
        label: "Fundraising",
        minStage: "deploy",
        children: [
          { href: "/founder/investors", label: "Investors", minStage: "deploy" },
          { href: "/founder/matching", label: "AI match center", minStage: "deploy" },
          { href: "/founder/investor-pipeline", label: "Pipeline", minStage: "deploy" },
          { href: "/founder/investors/outreach", label: "Outreach (CRM)", minStage: "deploy" },
          { href: "/founder/investors/matches", label: "Matches", minStage: "deploy" },
          { href: "/founder/deal-room", label: "Deal Room", minStage: "deploy" },
          { href: "/founder/capital-raise", label: "Capital Raise", minStage: "deploy" },
          { href: "/founder/spvs", label: "SPVs" },
        ],
      },
      {
        href: "/founder/business-plan",
        label: "Docs & models",
        children: [
          { href: "/founder/business-plan", label: "Business plan", minStage: "qualify" },
          { href: "/founder/pitch-deck", label: "Pitch deck", minStage: "qualify" },
          { href: "/founder/financial-model", label: "Financial model", minStage: "qualify" },
          { href: "/founder/cap-table", label: "Cap table", minStage: "qualify" },
          { href: "/founder/reg-cf", label: "Reg CF materials", minStage: "deploy" },
        ],
      },
      {
        href: "/founder/pitch-practice",
        label: "Prep & practice",
        children: [
          { href: "/founder/pitch-practice", label: "Pitch practice", minStage: "qualify" },
          { href: "/founder/pitch-deck-analyzer", label: "Pitch deck analyzer", minStage: "qualify" },
          { href: "/founder/board-prep", label: "Board meeting prep", minStage: "qualify" },
          { href: "/founder/term-sheet", label: "Term sheet explainer", minStage: "qualify" },
          { href: "/founder/kpi-glossary", label: "KPI glossary", minStage: "qualify" },
        ],
      },
      {
        href: "/founder/email-sequence",
        label: "Outreach & planning",
        children: [
          { href: "/founder/email-sequence", label: "Email sequences", minStage: "qualify" },
          { href: "/founder/investor-update", label: "Investor update builder", minStage: "qualify" },
          { href: "/founder/funding-timeline", label: "Funding timeline", minStage: "qualify" },
          { href: "/founder/due-diligence", label: "Due diligence checklist", minStage: "qualify" },
        ],
      },
      { href: "/events", label: "Events", minStage: "qualify" },
    ],
  },
  {
    title: "Inbox & calendar",
    items: [
      {
        href: "/founder/inbox",
        label: "Communications",
        children: [
          { href: "/founder/inbox", label: "Inbox" },
          { href: "/founder/messages", label: "Messages", minStage: "deploy" },
          { href: "/founder/updates", label: "Investor Updates", minStage: "deploy" },
        ],
      },
      {
        href: "/founder/calendar",
        label: "Calendar",
        children: [
          { href: "/founder/calendar", label: "Calendar" },
          { href: "/founder/schedule", label: "Scheduling" },
        ],
      },
      { href: "/notifications", label: "Notifications", minStage: "qualify" },
    ],
  },
  {
    title: "Grow",
    items: [
      {
        href: "/founder/learning",
        label: "Learning",
        minStage: "qualify",
        children: [
          { href: "/founder/learning", label: "Overview", minStage: "qualify" },
          { href: "/founder/learning/courses", label: "Browse courses", minStage: "qualify" },
          { href: "/founder/learning/plan", label: "My learning plan", minStage: "qualify" },
          { href: "/founder/learning/schedule", label: "My Schedule", minStage: "qualify" },
          { href: "/founder/learning/progress", label: "My progress", minStage: "qualify" },
          { href: "/founder/learning/stages/stage_0", label: "Stage 0 — Foundation", minStage: "qualify" },
          { href: "/founder/learning/stages/stage_1", label: "Stage 1 — Seed Round", minStage: "qualify" },
          { href: "/founder/learning/stages/stage_2", label: "Stage 2 — Series A", minStage: "qualify" },
          { href: "/founder/learning/stages/stage_3", label: "Stage 3 — Exit", minStage: "qualify" },
        ],
      },
      { href: "/founder/milestones", label: "Milestones", minStage: "optimize" },
      { href: "/founder/analytics", label: "Analytics", minStage: "optimize" },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/founder/settings",
        label: "Settings",
        children: [
          { href: "/founder/settings", label: "Company profile" },
          { href: "/founder/settings/team", label: "Team" },
          { href: "/founder/settings/billing", label: "Billing & subscription" },
          { href: "/founder/settings/integrations", label: "Integrations" },
          { href: "/founder/settings/feedback", label: "Feedback" },
        ],
      },
    ],
  },
];

export const founderWorkspaceNav: WorkspaceNavItem[] = founderWorkspaceNavSections.flatMap((section) => section.items);

export function getFounderWorkspaceNavSections(): WorkspaceNavSection[] {
  return founderWorkspaceNavSections;
}

// Investor menu mirrors the four-stage journey: Onboard → Verify → Access → Manage.
// Dashboard is pinned on top; cross-cutting tools sit in a Workspace group below.
export const investorWorkspaceNavSections: WorkspaceNavSection[] = [
  {
    items: [
      { href: "/investor/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Stage 1 · Onboarding",
    items: [
      { href: "/investor/onboarding", label: "Profile" },
    ],
  },
  {
    title: "Stage 2 · Verification",
    items: [
      { href: "/investor/verification", label: "Identity & accreditation" },
    ],
  },
  {
    title: "Stage 3 · Deals access",
    // Kept to actual deal access; cross-cutting tools (Communications, Calendar,
    // Learning, Analytics) live in the Workspace group below so the stage reads
    // as a clean funnel step.
    items: [
      {
        href: "/investor/opportunities",
        label: "Private Market",
        children: [
          { href: "/investor/opportunities", label: "Overview" },
          { href: "/investor/watchlist", label: "Watchlist" },
          { href: "/investor/interest-pipeline", label: "Interest Pipeline" },
          { href: "/investor/deal-room", label: "Deal Room" },
          { href: "/investor/deals", label: "Diligence" },
        ],
      },
      { href: "/events", label: "Events" },
      { href: "/investor/partner-score", label: "Partner Score" },
    ],
  },
  {
    title: "Stage 4 · Manage deals",
    items: [
      { href: "/investor/portfolio", label: "Portfolio" },
      { href: "/investor/spvs", label: "SPVs & closings" },
      { href: "/investor/activity", label: "Recent Activity" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/investor/actions", label: "Action Center" },
      { href: "/investor/tasks", label: "Tasks" },
      {
        href: "/investor/inbox",
        label: "Communications",
        children: [
          { href: "/investor/inbox", label: "Inbox" },
          { href: "/investor/messages", label: "Messages" },
        ],
      },
      {
        href: "/investor/calendar",
        label: "Calendar",
        children: [
          { href: "/investor/calendar", label: "Calendar" },
          { href: "/investor/schedule", label: "Scheduling" },
        ],
      },
      { href: "/investor/learning", label: "Learning" },
      { href: "/investor/analytics", label: "Analytics" },
      { href: "/notifications", label: "Notifications" },
      { href: "/investor/settings", label: "Settings" },
    ],
  },
];

export const investorWorkspaceNav: WorkspaceNavItem[] = investorWorkspaceNavSections.flatMap((section) => section.items);

export function getInvestorWorkspaceNavSections(): WorkspaceNavSection[] {
  return investorWorkspaceNavSections;
}

export const adminWorkspaceNav: WorkspaceNavItem[] = adminWorkspaceNavSections.flatMap((section) => section.items);

export function getAdminWorkspaceNavSections(): WorkspaceNavSection[] {
  return adminWorkspaceNavSections;
}

export function getWorkspaceNav(workspace: WorkspaceId): WorkspaceNavItem[] {
  switch (workspace) {
    case "founder":
      return founderWorkspaceNav;
    case "investor":
      return investorWorkspaceNav;
    case "admin":
      return adminWorkspaceNav;
  }
}

export function workspaceShellRole(workspace: WorkspaceId): Role {
  switch (workspace) {
    case "founder":
      return "FOUNDER";
    case "investor":
      return "INVESTOR";
    case "admin":
      return "ADMIN";
  }
}

export function workspaceLabel(workspace: WorkspaceId): string {
  switch (workspace) {
    case "founder":
      return "Founder Workspace";
    case "investor":
      return "Investor Workspace";
    case "admin":
      return "Admin Workspace";
  }
}

export function resolveWorkspaceFromPath(pathname: string): WorkspaceId | null {
  if (pathname === "/founder" || pathname.startsWith("/founder/")) {
    return "founder";
  }
  if (pathname === "/investor" || pathname.startsWith("/investor/")) {
    return "investor";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }
  return null;
}
