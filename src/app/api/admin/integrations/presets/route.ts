import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import {
  applySubscriptionPreset,
  getSubscriptionPreset,
  INTEGRATION_SUBSCRIPTION_PRESETS,
  type IntegrationSubscriptionPresetId,
} from "@/lib/integrations/subscription-presets";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ presets: INTEGRATION_SUBSCRIPTION_PRESETS });
}

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    connectionId?: string;
    presetId?: IntegrationSubscriptionPresetId;
    enabled?: boolean;
  };

  if (!body.connectionId || !body.presetId) {
    return NextResponse.json({ error: "connectionId and presetId required." }, { status: 400 });
  }

  if (!getSubscriptionPreset(body.presetId)) {
    return NextResponse.json({ error: "Invalid preset." }, { status: 400 });
  }

  const result = await applySubscriptionPreset(body.connectionId, body.presetId, body.enabled ?? true);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Preset apply failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
