/**
 * The client pick list in New message to client: founders and investors staff can
 * start a support thread with, with the company and plan that tell two people with
 * the same name apart. The shaping here is pure so it can be tested; the route
 * does the queries.
 */
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";

export type PickerClient = {
  id: string;
  name: string;
  email: string;
  role: "founder" | "investor";
  /** The founder's company. Empty for an investor. */
  company: string;
  /** Plan label for a founder, empty when there is no subscription row. */
  plan: string;
};

export type PickerProfile = { id: string; full_name: string | null; email: string | null; role: string };

/** Characters that would break a PostgREST or() filter or act as a LIKE wildcard. */
export function cleanSearch(raw: string): string {
  return raw.replace(/[%_,()*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function planLabelFor(planType: string | null | undefined): string {
  if (!planType) return "";
  return PLAN_LABELS[planType as PlanType] ?? "";
}

export function shapeClients(
  profiles: PickerProfile[],
  companyByFounder: Map<string, string>,
  planByProfile: Map<string, string>,
): PickerClient[] {
  return profiles
    .filter((p) => p.role === "founder" || p.role === "investor")
    .map((p) => {
      const role = p.role as "founder" | "investor";
      return {
        id: p.id,
        name: p.full_name?.trim() || p.email || "Unnamed user",
        email: p.email ?? "",
        role,
        company: role === "founder" ? companyByFounder.get(p.id) ?? "" : "",
        plan: role === "founder" ? planLabelFor(planByProfile.get(p.id)) : "",
      };
    });
}
