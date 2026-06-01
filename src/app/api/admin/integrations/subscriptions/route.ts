import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { setSubscription } from "@/lib/integrations/settings";
import type { OutboundIntegrationEventType } from "@/lib/integrations/types";
import { OUTBOUND_INTEGRATION_EVENTS } from "@/lib/integrations/types";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    connectionId?: string;
    eventType?: string;
    enabled?: boolean;
  };

  if (!body.connectionId || !body.eventType) {
    return NextResponse.json({ error: "connectionId and eventType required." }, { status: 400 });
  }

  if (!OUTBOUND_INTEGRATION_EVENTS.includes(body.eventType as OutboundIntegrationEventType)) {
    return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
  }

  await setSubscription(
    body.connectionId,
    body.eventType as OutboundIntegrationEventType,
    body.enabled ?? true,
  );

  return NextResponse.json({ ok: true });
}
