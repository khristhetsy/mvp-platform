import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBuilderPreview } from "@/components/page-builder/PageBuilderPreview";
import { requireSuperAdminPage } from "@/lib/api/super-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getDraftBySlug, isPageBuilderSlug } from "@/lib/page-builder/drafts";

export const dynamic = "force-dynamic";

export default async function PageBuilderPreviewPage({
  params,
}: Readonly<{ params: Promise<{ page: string }> }>) {
  await requireSuperAdminPage();
  const { page } = await params;

  if (!isPageBuilderSlug(page)) {
    notFound();
  }

  const supabase = createServiceRoleClient();
  const draft = await getDraftBySlug(supabase, page);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p>
            <strong>Lab preview</strong> for <code className="rounded bg-white px-1">/{page}</code> — not published to
            production.
          </p>
          <Link href="/admin/page-builder-lab" className="cap-btn-secondary rounded-lg px-3 py-1.5 text-xs font-semibold">
            Back to lab
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {draft ? (
          <PageBuilderPreview blocks={draft.layout.blocks} previewMode="desktop" />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No draft saved yet for this page. Create one in{" "}
            <Link href="/admin/page-builder-lab" className="font-semibold text-[var(--navy)] underline">
              Page Builder Lab
            </Link>
            .
          </div>
        )}
      </div>
    </main>
  );
}
