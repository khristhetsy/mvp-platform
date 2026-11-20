import { NextRequest, NextResponse } from "next/server";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { parseAgreementInput } from "@/lib/billing/premium-agreement-core";
import { renderAgreementPdf } from "@/lib/billing/premium-agreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST: the Premium Services Agreement filled with what a visitor typed, as a PDF, so they can
 * read it before they pay. For someone with no account yet. Nothing is recorded or stored.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "guest_agreement_preview", ip, limit: 20 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const parsed = parseAgreementInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const pdf = await renderAgreementPdf(parsed.value, new Date());
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="iCFO-Services-Agreement.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[billing/guest-agreement-preview]", err);
    return NextResponse.json({ error: "We could not prepare the agreement. Please try again." }, { status: 500 });
  }
}
