import type { InternalPermission } from "@/lib/rbac/constants";
import type { Role } from "@/lib/auth";

export type WorkspaceId = "founder" | "investor" | "admin";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  requiredPermission?: InternalPermission;
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
  { href: "/admin/crm", label: "CRM", requiredPermission: "manage_crm" },
  { href: "/admin/matching", label: "Matching", requiredPermission: "manage_matching" },
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
      { href: "/admin/learning", label: "Learning", requiredPermission: "manage_learning" },
      { href: "/admin/billing", label: "Billing", requiredPermission: "manage_billing" },
      { href: "/admin/diligence", label: "Diligence", requiredPermission: "manage_diligence" },
      { href: "/admin/compliance", label: "Compliance", requiredPermission: "manage_compliance" },
      { href: "/admin/audit", label: "Audit", requiredPermission: "view_audit_logs" },
      { href: "/admin/integrations", label: "Integrations", requiredPermission: "manage_integrations" },
      { href: "/admin/queues", label: "Queues", requiredPermission: "manage_queues" },
      { href: "/admin/automation", label: "Automation", requiredPermission: "manage_automation" },
      { href: "/admin/reports", label: "Reports", requiredPermission: "manage_reports" },
      { href: "/admin/imports", label: "Import / Export", requiredPermission: "manage_imports" },
      { href: "/admin/analytics", label: "Analytics", requiredPermission: "view_analytics" },
      { href: "/admin/insights", label: "Insights", requiredPermission: "view_insights" },
      { href: "/admin/system-health", label: "System Health", requiredPermission: "view_system_health" },
      { href: "/admin/beta-operations", label: "Beta Operations", requiredPermission: "manage_beta_operations" },
      { href: "/admin/users/permissions", label: "User Permissions", requiredPermission: "manage_users" },
    ],
  },
];

export const founderWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/founder/dashboard", label: "Dashboard" },
  { href: "/founder/actions", label: "Actions" },
  { href: "/founder/readiness", label: "Readiness" },
  { href: "/founder/documents", label: "Documents" },
  { href: "/founder/investors", label: "Investors" },
  { href: "/founder/matching", label: "Matching" },
  { href: "/founder/deal-room", label: "Deal Room" },
  { href: "/founder/messages", label: "Messages" },
  { href: "/founder/capital-raise", label: "Capital Raise" },
  { href: "/founder/spvs", label: "SPVs" },
  { href: "/founder/learning", label: "Learning" },
  { href: "/founder/analytics", label: "Analytics" },
  { href: "/founder/settings", label: "Settings" },
];

export const investorWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/investor/dashboard", label: "Dashboard" },
  { href: "/investor/actions", label: "Actions" },
  { href: "/investor/onboarding", label: "Onboarding" },
  { href: "/investor/opportunities", label: "Opportunities" },
  { href: "/investor/watchlist", label: "Watchlist" },
  { href: "/investor/interest-pipeline", label: "Interest Pipeline" },
  { href: "/investor/deal-room", label: "Deal Room" },
  { href: "/investor/spvs", label: "SPVs" },
  { href: "/investor/portfolio", label: "Portfolio" },
  { href: "/investor/messages", label: "Messages" },
  { href: "/investor/analytics", label: "Analytics" },
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
