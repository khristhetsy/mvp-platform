import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { normalizeUserRole, STAFF_ROLES } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getWireInstructions, getWireInvoice } from "@/lib/billing/wire";
import { renderWireInvoicePdf } from "@/lib/billing/wire-invoice-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A wire invoice as a PDF. A founder may download only their own; staff
 * (admin, analyst) may download any. Inline by default; ?download=1 attaches.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;

  const invoice = await getWireInvoice(id);
  const role = normalizeUserRole(profile.role);
  const isStaff = Boolean(role && STAFF_ROLES.includes(role));
  // Same answer for "missing" and "not yours", so ids can't be probed.
  if (!invoice || (!isStaff && invoice.profile_id !== profile.id)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const admin = createServiceRoleClient() as any;
  const [{ data: person }, companyRes] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", invoice.profile_id).maybeSingle(),
    invoice.company_id ? admin.from("companies").select("company_name").eq("id", invoice.company_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = person as { full_name: string | null; email: string | null } | null;
  const c = (companyRes as { data: { company_name: string | null } | null }).data;

  const pdf = await renderWireInvoicePdf({
    invoice,
    instructions: await getWireInstructions(),
    billTo: { name: p?.full_name ?? null, email: p?.email ?? null, company: c?.company_name ?? null },
  });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = `icapos-${invoice.invoice_number.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
