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

  if (path.startsWith("/founder/learning")) return "learning";
  if (path.startsWith("/founder/readiness") || path.startsWith("/founder/report")) return "reports_guidance";
  if (path.includes("/spv") || path.startsWith("/investor/spvs")) return "spv_guidance";
  if (path.startsWith("/admin/compliance")) return "compliance_guidance";
  if (path.startsWith("/admin/reports")) return "reports_guidance";
  if (path.startsWith("/founder/capital-raise")) return "founder_workflow";

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
