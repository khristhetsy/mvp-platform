import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { getPage, setStatus, setComplianceStatus, logAction } from "@/lib/aeo/store";
import { runAeoComplianceCheck } from "@/lib/aeo/compliance";
import { runExposureCheck } from "@/lib/aeo/exposure-check";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["publish", "unpublish"]).default("publish") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const action = parsed.success ? parsed.data.action : "publish";

    const page = await getPage(id);
    if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (action === "unpublish") {
      await setStatus(id, "draft", null);
      await logAction(id, "unpublished", profile.id);
      revalidatePaths(page.slug);
      return NextResponse.json({ ok: true, status: "draft" });
    }

    // ── Gate 1: compliance (re-run fresh, don't just trust stored status) ──
    const compliance = runAeoComplianceCheck({
      lede: page.lede,
      definitionAnswer: page.definitionAnswer,
      sections: page.sections,
      faq: page.faq,
    });
    if (compliance.status !== "cleared") {
      await setComplianceStatus(id, "flagged");
      await logAction(id, "compliance_flagged", profile.id, compliance.violations.map((v) => `${v.check}:${v.phrase}`).join(", ").slice(0, 400));
      return NextResponse.json(
        { error: "Publish blocked: language check failed.", reason: "compliance", violations: compliance.violations },
        { status: 422 },
      );
    }

    // ── Gate 2: exposure (fix-first blockers must be resolved) ──
    const exposure = await runExposureCheck();
    if (!exposure.ok) {
      return NextResponse.json(
        { error: "Publish blocked: unresolved site exposures.", reason: "exposure", blockers: exposure.blockers.filter((b) => !b.resolved) },
        { status: 422 },
      );
    }

    // Both gates pass → publish + revalidate + log.
    await setComplianceStatus(id, "cleared");
    await setStatus(id, "published", new Date().toISOString());
    await logAction(id, "published", profile.id);
    revalidatePaths(page.slug);

    return NextResponse.json({ ok: true, status: "published" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Publish failed." }, { status: 500 });
  }
}

function revalidatePaths(slug: string): void {
  try {
    revalidatePath(`/learn/${slug}`);
    revalidatePath("/learn/sitemap.xml");
    revalidatePath("/sitemap.xml");
  } catch {
    /* revalidation is best-effort */
  }
}
