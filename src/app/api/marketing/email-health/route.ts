import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

// GET /api/marketing/email-health — admin diagnostic for the Resend integration.
// Reports the SHAPE of the configured key (never the value) and makes a live
// call to Resend so the exact failure reason is visible.
export async function GET(): Promise<NextResponse> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const raw = process.env.RESEND_API_KEY ?? "";
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^["']|["']$/g, "").replace(/^bearer\s+/i, "").replace(/\s+/g, "");

  const shape = {
    present: raw.length > 0,
    rawLength: raw.length,
    cleanedLength: cleaned.length,
    startsWithRe: cleaned.startsWith("re_"),
    hadSurroundingQuotes: /^["']/.test(trimmed) || /["']$/.test(trimmed),
    hadWhitespace: /\s/.test(trimmed),
    hadBearerPrefix: /^bearer\s+/i.test(trimmed),
  };

  let live: { ok: boolean; status: number | null; message: string } = { ok: false, status: null, message: "No key configured." };
  if (cleaned) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${cleaned}` },
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
      live = {
        ok: res.ok,
        status: res.status,
        message: res.ok ? "Resend accepted the key." : (data?.message ?? data?.error?.message ?? `HTTP ${res.status}`),
      };
    } catch (e) {
      live = { ok: false, status: null, message: e instanceof Error ? e.message : "request failed" };
    }
  }

  return NextResponse.json({ shape, live });
}
