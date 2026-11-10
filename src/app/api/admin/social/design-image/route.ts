import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isClaudeConfigured } from "@/lib/claude";
import { DESIGN_SIZES, DESIGN_STYLES, type DesignSize, type DesignStyle } from "@/lib/social/design-config";
import { designCopy } from "@/lib/social/design-spec";
import { renderDesign, type DesignGraphic, type DesignLayout } from "@/lib/social/design-render";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Same public bucket the Upload tab uses, so a designed image posts like an uploaded one.
const BUCKET = "marketing-assets";
const OPTIONS = 3;
// Each option gets a different layout so the three look different.
const LOOKS: { layout: DesignLayout; graphic: DesignGraphic }[] = [
  { layout: "left", graphic: "circles" },
  { layout: "center", graphic: "blocks" },
  { layout: "left", graphic: "none" },
];

const schema = z.object({
  request: z.string().trim().min(10).max(1000),
  style: z.enum(Object.keys(DESIGN_STYLES) as [DesignStyle, ...DesignStyle[]]),
  size: z.enum(Object.keys(DESIGN_SIZES) as [DesignSize, ...DesignSize[]]),
});

// Design 3 options in parallel. An option that fails is skipped; the call fails only if none work.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admin only." }, { status: 403 });
  if (!isClaudeConfigured()) return NextResponse.json({ error: "Claude is not connected yet, so designs are unavailable." }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Describe the banner in at least 10 characters." }, { status: 400 });
  const { request, style, size } = parsed.data;
  const { w, h } = DESIGN_SIZES[size];
  const admin = createServiceRoleClient();

  const results = await Promise.all(
    Array.from({ length: OPTIONS }, async (_, i) => {
      try {
        const spec = await designCopy(request, style, i);
        if (!spec) return null;
        const png = await renderDesign(spec, style, size, LOOKS[i].layout, LOOKS[i].graphic);
        const path = `${profile.id}/${Date.now()}-design-${i + 1}.png`;
        const { error } = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
        if (error) return null;
        const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl ? { url: data.publicUrl } : null;
      } catch {
        return null;
      }
    }),
  );
  const options = results.filter((o): o is { url: string } => o !== null);
  if (options.length === 0) return NextResponse.json({ error: "Claude could not design that one. Try rewording the request." }, { status: 502 });
  return NextResponse.json({ options, width: w, height: h });
}
