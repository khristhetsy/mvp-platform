import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { sendIntegrationTest } from "@/lib/integrations/delivery";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required." }, { status: 400 });
  }

  const result = await sendIntegrationTest(body.connectionId, auth.profile.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Test failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, logId: result.logId });
}
