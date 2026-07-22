import { requireRole } from "@/lib/supabase/auth";
import { listMastersWithCounts } from "@/lib/email/masters-queries";
import { EmailGalleryClient } from "./EmailGalleryClient";

export const dynamic = "force-dynamic";

// Branded email template gallery (build spec §5). Sits alongside the existing
// block-based template editor at ../templates; this is the guardrailed,
// pick-a-master-and-fill-slots path.
export default async function EmailTemplateGalleryPage() {
  await requireRole(["admin"]);
  const masters = await listMastersWithCounts();

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-medium text-slate-900">Branded email templates</h1>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Pick a brand-locked master, fill in the content, and send. Logo, colours, and the unsubscribe footer are fixed —
        only the banner and content slots are editable. For a fully custom layout, use the{" "}
        <a href="/admin/marketing/templates" className="text-blue-600 hover:underline">
          custom template builder
        </a>
        .
      </p>
      <EmailGalleryClient masters={masters} />
    </div>
  );
}
