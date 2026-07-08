import type { AssistantMode } from "@/lib/assistant/types";

const ADMIN_ENTITY_PATHS = [
  { pattern: /^\/admin\/companies\/([^/]+)/, type: "company" },
  { pattern: /^\/admin\/investors\/([^/]+)/, type: "investor" },
  { pattern: /^\/admin\/spvs\/([^/]+)/, type: "spv" },
] as const;

export function inferAssistantMode(input: {
  role: "founder" | "investor" | "admin" | "analyst";
  currentPath?: string | null;
  requestedMode?: AssistantMode;
}): AssistantMode {
  if (input.requestedMode) return input.requestedMode;

  const path = input.currentPath ?? "";

  // Founder pages
  if (path.startsWith("/founder/learning")) return "learning";
  if (path.startsWith("/founder/readiness") || path.startsWith("/founder/report")) return "reports_guidance";
  if (path.startsWith("/founder/capital-raise")) return "capital_raise";
  if (path.startsWith("/founder/deal-room")) return "deal_room";
  if (path.startsWith("/founder/contacts") || path.startsWith("/admin/marketing/contacts")) return "crm";
  if (path.startsWith("/billing")) return "billing";
  if (path.startsWith("/admin/tasks") || path.startsWith("/founder/tasks")) return "tasks";

  // SPV / compliance / reports
  if (path.includes("/spv") || path.startsWith("/investor/spvs")) return "spv_guidance";
  if (path.startsWith("/admin/compliance")) return "compliance_guidance";
  if (path.startsWith("/admin/reports")) return "reports_guidance";

  // CEO Hub → Chief of Staff
  if (path.startsWith("/admin/ceo")) return "ceo_hub";

  // Admin marketing → CMO AI
  if (path.startsWith("/admin/marketing")) return "cmo_marketing";

  // Investor pages
  if (
    path.startsWith("/investor/watchlist") ||
    path.startsWith("/investor/opportunities") ||
    path.startsWith("/investor/interest-pipeline")
  ) return "investor_pipeline";
  if (path.startsWith("/investor/portfolio") || path.startsWith("/investor/deals")) return "investor_portfolio";
  if (path.startsWith("/deals") || path.startsWith("/investor/matching")) return "investor_matching";
  if (path.startsWith("/investor/deal-room")) return "deal_room";

  if (input.role === "admin" || input.role === "analyst") return "admin_operations";
  if (input.role === "investor") return "investor_workflow";
  return "founder_workflow";
}

export function parseEntityFromPath(currentPath?: string | null): {
  type: string;
  id: string;
} | null {
  if (!currentPath) return null;
  for (const entry of ADMIN_ENTITY_PATHS) {
    const match = currentPath.match(entry.pattern);
    if (match?.[1]) {
      return { type: entry.type, id: match[1] };
    }
  }
  return null;
}

export function workspaceLabelForRole(role: "founder" | "investor" | "admin" | "analyst"): string {
  switch (role) {
    case "founder":
      return "Founder workspace";
    case "investor":
      return "Investor workspace";
    case "analyst":
      return "Analyst workspace";
    default:
      return "Admin operations";
  }
}

export function contextUsedKeys(summary: Record<string, string | number | boolean | null>): string[] {
  return Object.entries(summary)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key]) => key);
}
