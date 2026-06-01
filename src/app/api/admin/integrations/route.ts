import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import {
  listIntegrationConnections,
  updateIntegrationConnection,
} from "@/lib/integrations/settings";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations/types";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const connections = await listIntegrationConnections();
  return NextResponse.json({ connections });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    provider?: IntegrationProvider;
    enabled?: boolean;
    display_name?: string;
    webhook_url?: string | null;
    signing_secret?: string | null;
  };

  if (!body.provider || !INTEGRATION_PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  const result = await updateIntegrationConnection(body.provider, {
    enabled: body.enabled,
    display_name: body.display_name,
    webhook_url: body.webhook_url,
    signing_secret: body.signing_secret,
    actorId: auth.profile.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Update failed." }, { status: 400 });
  }

  const connections = await listIntegrationConnections();
  return NextResponse.json({ connections });
}
