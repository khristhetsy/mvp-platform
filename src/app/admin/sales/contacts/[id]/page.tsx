import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadContactPageProps } from "@/lib/sales/contact-page-data";
import { SalesHubHeader } from "../../SalesHubHeader";
import { ContactProfileClient } from "./ContactProfileClient";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { FieldDisplayProvider } from "@/lib/profile-fields/display-provider";
import { loadSurfaceDisplay } from "@/lib/profile-fields/display-store";

export const dynamic = "force-dynamic";

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const props = await loadContactPageProps(profile, id);
  if (!props) notFound();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <VocabularyProvider value={await loadVocabularies()}>
        <FieldDisplayProvider value={await loadSurfaceDisplay("admin_editors")}>
          <ContactProfileClient {...props} />
        </FieldDisplayProvider>
      </VocabularyProvider>
    </AppShell>
  );
}
