import { notifyStaff } from "@/lib/notifications/notifications";
import type { ComplianceSeverity } from "@/lib/compliance/types";

export async function notifyStaffComplianceAlert(input: {
  eventId: string;
  severity: ComplianceSeverity;
  title: string;
  description: string;
}) {
  return notifyStaff({
    actorUserId: null,
    type: "compliance_event_created",
    title: `Compliance alert (${input.severity})`,
    message: `${input.title}: ${input.description}`,
    entityType: "compliance_event",
    entityId: input.eventId,
  });
}
