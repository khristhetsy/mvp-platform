import type { InternalPermission } from "@/lib/rbac/constants";
import type { Role } from "@/lib/auth";

export type WorkspaceId = "founder" | "investor" | "admin";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  requiredPermission?: InternalPermission;
  children?: WorkspaceNavItem[];
};

export type WorkspaceNavSection = {
  title?: string;
  items: WorkspaceNavItem[];
};

/** Admin operations cluster: companies, SPVs, investors, deal rooms, CRM. */
export const adminOperationsNav: WorkspaceNavItem[] = [
  { href: "/admin/companies", label: "Companies", requiredPermission: "manage_companies" },
  { href: "/admin/spvs", label: "SPVs", requiredPermission: "manage_spvs" },
  { href: "/admin/investors", label: "Investors", requiredPermission: "manage_investors" },
  { href: "/admin/deal-rooms", label: "Deal Rooms", requiredPermission: "manage_deal_rooms" },
  {
    href: "/admin/crm",
    label: "CRM",
    requiredPermission: "manage_crm",
    children: [
      { href: "/admin/crm", label: "Activity" },
      { href: "/admin/crm/pipeline", label: "Pipeline" },
      { href: "/admin/crm/messages", label: "Messages" },
      { href: "/admin/crm/outreach", label: "Outreach" },
    ],
  },
  { href: "/admin/matching", label: "Matching", requiredPermission: "manage_matching" },
  { href: "/admin/readiness", label: "Readiness Scores", requiredPermission: "manage_companies" },
];

export const adminWorkspaceNavSections: WorkspaceNavSection[] = [
  {
    items: [
      { href: "/admin/dashboard", label: "Dashboard", requiredPermission: "view_admin_dashboard" },
      { href: "/admin/actions", label: "Actions", requiredPermission: "view_actions" },
    ],
  },
  {
    title: "Operations",
    items: adminOperationsNav,
  },
  {
    items: [
      {
        href: "/admin/learning",
        label: "Learning",
        requiredPermission: "manage_learning",
        children: [
          { href: "/admin/learning", label: "Overview" },
          { href: "/admin/learning/courses", label: "Courses" },
          { href: "/admin/learning/founders", label: "Founder roster" },
        ],
      },
      { href: "/admin/billing", label: "Billing", requiredPermission: "manage_billing" },
      {
        href: "/admin/analytics",
        label: "Analytics",
        requiredPermission: "view_analytics",
        children: [
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/reports", label: "Reports" },
          { href: "/admin/insights", label: "Insights" },
        ],
      },
      {
        href: "/admin/compliance",
        label: "Compliance",
        requiredPermission: "manage_compliance",
        children: [
          { href: "/admin/diligence", label: "Diligence" },
          { href: "/admin/compliance", label: "Compliance" },
          { href: "/admin/audit", label: "Audit" },
        ],
      },
      {
        href: "/admin/integrations",
        label: "System",
        requiredPermission: "manage_integrations",
        children: [
          { href: "/admin/integrations", label: "Integrations" },
          { href: "/admin/queues", label: "Queues" },
          { href: "/admin/automation", label: "Automation" },
          { href: "/admin/system-health", label: "System Health" },
          { href: "/admin/imports", label: "Import / Export" },
          { href: "/admin/beta-operations", label: "Beta Operations" },
        ],
      },
      { href: "/admin/users/manage", label: "User Management", requiredPermission: "manage_users" },
      { href: "/admin/users/permissions", label: "User Permissions", requiredPermission: "manage_users" },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        href: "/admin/marketing",
        label: "Marketing Hub",
        requiredPermission: "view_admin_dashboard",
        children: [
          { href: "/admin/marketing", label: "Dashboard" },
          { href: "/admin/marketing/contacts", label: "Contacts" },
          { href: "/admin/marketing/campaigns", label: "Campaigns" },
          { href: "/admin/marketing/sequences", label: "Sequences" },
          { href: "/admin/marketing/templates", label: "Templates" },
          { href: "/admin/marketing/analytics", label: "Analytics" },
          { href: "/admin/marketing/plan", label: "Plans" },
        ],
      },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/admin/tasks", label: "Tasks", requiredPermission: "view_admin_dashboard" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { href: "/admin/portfolio", label: "Portfolio oversight", requiredPermission: "view_admin_dashboard" },
    ],
  },
];

export const founderWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/founder/dashboard", label: "Dashboard" },
  { href: "/founder/actions", label: "Actions" },
  {
    href: "/founder/readiness",
    label: "Readiness",
    children: [
      { href: "/founder/readiness", label: "Checklist" },
      { href: "/founder/readiness/diligence", label: "Diligence & review" },
      { href: "/founder/readiness/documents", label: "Document checklist" },
      { href: "/founder/readiness/missing", label: "Missing documents" },
    ],
  },
  { href: "/founder/documents", label: "Documents" },
  {
    href: "/founder/investors",
    label: "Investors",
    children: [
      { href: "/founder/investors", label: "Overview" },
      { href: "/founder/investors/outreach", label: "Outreach & CRM" },
      { href: "/founder/investors/matches", label: "Platform matches" },
    ],
  },
  { href: "/founder/matching", label: "Matching" },
  { href: "/founder/deal-room", label: "Deal Room" },
  { href: "/founder/messages", label: "Messages" },
  { href: "/founder/capital-raise", label: "Capital Raise" },
  { href: "/founder/spvs", label: "SPVs" },
  {
    href: "/founder/learning",
    label: "Learning",
    children: [
      { href: "/founder/learning", label: "Overview" },
      { href: "/founder/learning/courses", label: "Browse courses" },
      { href: "/founder/learning/plan", label: "My learning plan" },
      { href: "/founder/learning/schedule", label: "Schedule" },
      { href: "/founder/learning/progress", label: "My progress" },
      { href: "/founder/learning/stages/stage_0", label: "Stage 0 — Foundation" },
      { href: "/founder/learning/stages/stage_1", label: "Stage 1 — Seed Round" },
      { href: "/founder/learning/stages/stage_2", label: "Stage 2 — Series A" },
      { href: "/founder/learning/stages/stage_3", label: "Stage 3 — Exit" },
    ],
  },
  { href: "/founder/analytics", label: "Analytics" },
  { href: "/founder/tasks", label: "Tasks" },
  { href: "/founder/settings", label: "Settings" },
];

export const investorWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/investor/dashboard", label: "Dashboard" },
  { href: "/investor/actions", label: "Actions" },
  { href: "/investor/onboarding", label: "Onboarding" },
  {
    href: "/investor/opportunities",
    label: "Deal Flow",
    children: [
      { href: "/investor/opportunities", label: "Opportunities" },
      { href: "/investor/watchlist", label: "Watchlist" },
      { href: "/investor/interest-pipeline", label: "Interest Pipeline" },
      { href: "/investor/activity", label: "Recent Activity" },
    ],
  },
  {
    href: "/investor/portfolio",
    label: "Portfolio & Deals",
    children: [
      { href: "/investor/portfolio", label: "Portfolio" },
      { href: "/investor/deal-room", label: "Deal Room" },
      { href: "/investor/spvs", label: "SPVs" },
    ],
  },
  { href: "/investor/messages", label: "Messages" },
  { href: "/investor/analytics", label: "Analytics" },
  { href: "/investor/tasks", label: "Tasks" },
  { href: "/investor/settings", label: "Settings" },
];

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
