import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import {
  buildPayloadPreviewForEvent,
  buildPayloadPreviewForTemplate,
  payloadToPreview,
} from "@/lib/integrations/payload-preview";
import { buildSanitizedPayload } from "@/lib/integrations/outbound-events";
import type { OutboundIntegrationEventType } from "@/lib/integrations/types";
import { OUTBOUND_INTEGRATION_EVENTS } from "@/lib/integrations/types";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId");
  const eventType = url.searchParams.get("eventType");

  if (templateId) {
    const preview = buildPayloadPreviewForTemplate(templateId);
    if (!preview) {
      return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    }
    return NextResponse.json({ preview });
  }

  if (eventType && OUTBOUND_INTEGRATION_EVENTS.includes(eventType as OutboundIntegrationEventType)) {
    return NextResponse.json({
      preview: buildPayloadPreviewForEvent(eventType as OutboundIntegrationEventType),
    });
  }

  const preview = payloadToPreview(
    buildSanitizedPayload({
      event_type: "workflow_action_created",
      title: "iCapOS integration test",
      severity: "info",
      metadata: { test: true },
    }),
  );

  return NextResponse.json({ preview });
}
