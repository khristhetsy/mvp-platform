import { AppShell } from "@/components/AppShell";
import { PageBuilderLab } from "@/components/page-builder/PageBuilderLab";
import { requirePageBuilderPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function PageBuilderLabPage() {
  const { profile } = await requirePageBuilderPage();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <PageBuilderLab />
      <p className="mt-6 text-xs text-slate-500">
        Signed in as {profile.email ?? profile.full_name ?? profile.id}
      </p>
    </AppShell>
  );
}
