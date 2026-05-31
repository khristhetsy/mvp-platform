import { PageBuilderLab } from "@/components/page-builder/PageBuilderLab";
import { requireSuperAdminPage } from "@/lib/api/super-admin";

export const dynamic = "force-dynamic";

export default async function PageBuilderLabPage() {
  const { profile } = await requireSuperAdminPage();

  return (
    <div>
      <PageBuilderLab />
      <p className="mt-6 text-xs text-slate-500">
        Signed in as super admin · {profile.email ?? profile.full_name ?? profile.id}
      </p>
    </div>
  );
}
