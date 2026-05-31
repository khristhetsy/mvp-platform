import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import type { ComplianceSeverity } from "@/lib/compliance/types";

export async function notifyStaffComplianceAlert(input: {
  eventId: string;
  severity: ComplianceSeverity;
  title: string;
  description: string;
}) {
  return notifyStaffIfNotRecent({
    actorUserId: null,
    type: "compliance_event_created",
    withinHours: 12,
    title: `Compliance alert (${input.severity})`,
    message: `${input.title}: ${input.description}`,
    entityType: "compliance_event",
    entityId: input.eventId,
  });
}
