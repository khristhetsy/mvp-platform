import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { markWireReceived, sendWireReminder, voidWireInvoice } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ action: z.enum(["received", "reminder", "void"]) });

/**
 * POST /api/admin/billing/wire/[id] { action }: a staff member (manage_billing)
 * marks a wire received (activates Premium, emails a receipt), sends a
 * reminder, or voids the invoice.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return auth.error as Response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const { id } = await params;

  try {
    if (parsed.data.action === "received") {
      const r = await markWireReceived(id, auth.userId);
      return NextResponse.json({ ok: true, invoice: r.invoice, emailed: r.emailed, warning: r.warning });
    }
    if (parsed.data.action === "reminder") {
      const r = await sendWireReminder(id, auth.userId);
      if (!r.emailed) return NextResponse.json({ error: "The reminder was not sent. The founder has no email on file, email is turned off for this account, or the email provider is not configured." }, { status: 502 });
      return NextResponse.json({ ok: true, invoice: r.invoice, emailed: true });
    }
    const invoice = await voidWireInvoice(id, auth.userId);
    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed." }, { status: 400 });
  }
}
