import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { payloadToPreview } from "@/lib/integrations/payload-preview";
import { sendIntegrationTest } from "@/lib/integrations/delivery";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    connectionId?: string;
    templateId?: string;
    previewOnly?: boolean;
  };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required." }, { status: 400 });
  }

  const result = await sendIntegrationTest(body.connectionId, auth.profile.id, {
    templateId: body.templateId,
    previewOnly: body.previewOnly,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Test failed." }, { status: 400 });
  }

  if (body.previewOnly && result.preview) {
    return NextResponse.json({ ok: true, preview: payloadToPreview(result.preview) });
  }

  return NextResponse.json({ ok: true, logId: result.logId });
}
