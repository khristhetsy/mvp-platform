import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { VocabularyManager, type ManagedOption } from "@/components/admin/VocabularyManager";

export const dynamic = "force-dynamic";

/**
 * The option lists every form draws from.
 *
 * Read here rather than through the cached loader: staff editing the lists
 * must see what they just saved, including archived values, which the loader
 * deliberately filters for pickers.
 */
async function loadOptions(): Promise<ManagedOption[]> {
  try {
    const db = createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data } = await db
      .from("vocabulary_options")
      .select("id, list, slug, label, sort_order, archived")
      .order("list", { ascending: true })
      .order("sort_order", { ascending: true });
    return (data ?? []) as ManagedOption[];
  } catch {
    return [];
  }
}

export default async function AdminProfileFieldsPage() {
  const { profile } = await requirePermissionPage("manage_settings");
  const options = await loadOptions();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Profile and fields"
    >
      <PageHeader
        eyebrow="Administration"
        title="Profile and fields"
        description="The words every form offers. Editing a value here changes founder onboarding, the company profile, investor profiles, event registration and the sector tracks at once."
      />

      {options.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">The lists are not in the database yet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-800">
            Nothing is broken — every form is still rendering its built-in list. Run
            <span className="mx-1 font-mono text-[12px]">docs/sql/vocabulary-options.sql</span>
            and this page fills in.
          </p>
        </div>
      ) : (
        <VocabularyManager initial={options} />
      )}
    </AppShell>
  );
}
