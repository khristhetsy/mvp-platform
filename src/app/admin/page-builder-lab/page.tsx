import { PageBuilderLab } from "@/components/page-builder/PageBuilderLab";
import { requirePageBuilderPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function PageBuilderLabPage() {
  const { profile } = await requirePageBuilderPage();

  return (
    <div>
      <PageBuilderLab />
      <p className="mt-6 text-xs text-slate-500">
        Signed in as {profile.email ?? profile.full_name ?? profile.id}
      </p>
    </div>
  );
}
