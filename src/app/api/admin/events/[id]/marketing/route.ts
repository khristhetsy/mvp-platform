import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadMarketing, saveMarketing, type MarketingPatch } from "@/lib/icfo-events/marketing";
import { generateCampaignKit } from "@/lib/icfo-events/marketing-ai";
import { getEventById } from "@/lib/icfo-events/queries";

export const dynamic = "force-dynamic";

const brochureSchema = z.object({
  headline: z.string().max(200),
  subhead: z.string().max(300),
  body: z.string().max(5000),
  highlights: z.array(z.string().max(300)).max(8),
  cta: z.string().max(120),
});
const emailSchema = z.object({
  subject: z.string().max(200),
  preheader: z.string().max(300),
  body: z.string().max(8000),
});
const socialSchema = z.object({
  linkedin: z.string().max(3000),
  facebook: z.string().max(3000),
  instagram: z.string().max(2200),
});
const saveSchema = z.object({
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.string().max(500).optional(),
  brochure: brochureSchema.optional(),
  email: emailSchema.optional(),
  social: socialSchema.optional(),
});

/** Load the saved marketing kit (staff). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const marketing = await loadMarketing(auth.supabase, id);
    return NextResponse.json({ marketing });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load marketing kit." }, { status: 500 });
  }
}

/** Save (upsert) marketing sections (staff). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = saveSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    const marketing = await saveMarketing(auth.supabase, id, auth.userId, parsed.data as MarketingPatch);
    return NextResponse.json({ marketing });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to save marketing kit." }, { status: 500 });
  }
}

const genSchema = z.object({ tone: z.string().max(120).optional() });

/** Generate a fresh kit with AI from the event's real data (staff). Returns the
 *  draft for review — it is NOT saved until the admin saves. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = genSchema.safeParse(await req.json().catch(() => ({})));
    const event = await getEventById(auth.supabase, id).catch(() => null);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const draft = await generateCampaignKit(event, { tone: parsed.success ? parsed.data.tone : undefined });
    return NextResponse.json({ marketing: draft });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to generate marketing kit." }, { status: 500 });
  }
}
