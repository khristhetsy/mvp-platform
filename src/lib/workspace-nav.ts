import type { InternalPermission } from "@/lib/rbac/constants";
import type { Role } from "@/lib/auth";

export type WorkspaceId = "founder" | "investor" | "admin";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  requiredPermission?: InternalPermission;
};

export const founderWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/founder/dashboard", label: "Dashboard" },
  { href: "/founder/actions", label: "Actions" },
  { href: "/founder/readiness", label: "Readiness" },
  { href: "/founder/documents", label: "Documents" },
  { href: "/founder/investors", label: "Investors" },
  { href: "/founder/messages", label: "Messages" },
  { href: "/founder/capital-raise", label: "Capital Raise" },
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
  { href: "/investor/spvs", label: "SPVs" },
  { href: "/investor/portfolio", label: "Portfolio" },
  { href: "/investor/messages", label: "Messages" },
  { href: "/investor/analytics", label: "Analytics" },
  { href: "/investor/settings", label: "Settings" },
];

export const adminWorkspaceNav: WorkspaceNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/actions", label: "Actions" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/spvs", label: "SPVs" },
  { href: "/admin/investors", label: "Investors" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/diligence", label: "Diligence" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/automation", label: "Automation" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/imports", label: "Import / Export" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/system-health", label: "System Health" },
  { href: "/admin/page-builder-lab", label: "Page Builder Lab", requiredPermission: "manage_page_builder" },
  { href: "/admin/users/permissions", label: "User Permissions", requiredPermission: "manage_users" },
];

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
