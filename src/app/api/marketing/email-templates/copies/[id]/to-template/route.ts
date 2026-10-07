import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getCopyWithMaster } from "@/lib/email/masters-queries";
import { renderCopyHtml } from "@/lib/email/render-copy";
import { createTemplate } from "@/lib/marketing/templates";

// "Use in campaign": save the filled-in branded copy into the Marketing
// templates library (marketing_templates), which campaigns and mass email
// already send from. Subject comes from the headline, the inbox preview line
// from the preheader. Saved as a draft; the copy itself is unchanged.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const { id } = await params;
    const copy = await getCopyWithMaster(id);
    if (!copy) return NextResponse.json({ error: "Template copy not found." }, { status: 404 });

    const slots = copy.slot_values ?? {};
    const template = await createTemplate(
      {
        name: copy.name,
        subject: (slots.headline ?? "").trim() || copy.name,
        preview_text: (slots.preheader ?? "").trim() || null,
        html_body: renderCopyHtml(copy, "campaign"),
        blocks: null,
        category: "general",
        status: "draft",
      },
      profile.id,
    );
    return NextResponse.json({ templateId: template.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save to templates.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
