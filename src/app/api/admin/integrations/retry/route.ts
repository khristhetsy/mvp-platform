import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { deliverIntegrationLog } from "@/lib/integrations/delivery";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { deliveryLogId?: string };
  if (!body.deliveryLogId) {
    return NextResponse.json({ error: "deliveryLogId required." }, { status: 400 });
  }

  const result = await deliverIntegrationLog(body.deliveryLogId, {
    actorId: auth.profile.id,
    isManualRetry: true,
  });
  if (!result.ok && result.error?.includes("Max delivery")) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Retry failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
