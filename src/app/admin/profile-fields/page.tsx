import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ProfileFieldsManager } from "@/components/admin/ProfileFieldsManager";
import { FIELD_SECTIONS } from "@/lib/profile-fields/catalog";
import type { DraftOption } from "@/lib/profile-fields/draft";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

type Row = { list: string; slug: string; label: string; archived: boolean; description: string | null };

/**
 * Read here rather than through the cached loader: staff editing the lists must
 * see what they just saved, including retired values, which pickers filter out.
 */
async function loadOptions(): Promise<Record<string, DraftOption[]>> {
  const out: Record<string, DraftOption[]> = {};
  try {
    const db = createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data } = await db
      .from("vocabulary_options")
      .select("list, slug, label, archived, description")
      .order("sort_order", { ascending: true });
    for (const r of (data ?? []) as Row[]) {
      (out[r.list] ??= []).push({ slug: r.slug, label: r.label, archived: Boolean(r.archived), description: r.description ?? null });
    }
  } catch {
    // Empty result renders the "not in the database" notice below.
  }
  return out;
}

/** Companies holding each value, for the lists that map to a company column. One read. */
async function loadCounts(): Promise<Record<string, Record<string, number>>> {
  const cols = [...new Set(FIELD_SECTIONS.flatMap((s) => s.answerColumns ?? []))];
  const out: Record<string, Record<string, number>> = {};
  try {
    const db = createServiceRoleClient() as unknown as import("@supabase/supabase-js").SupabaseClient;
    const res: { data: unknown } = await db.from("companies").select(cols.join(", "));
    const rows: Record<string, unknown>[] = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
    for (const section of FIELD_SECTIONS) {
      const columns: string[] = section.answerColumns ?? [];
      if (columns.length === 0) continue;
      const m: Record<string, number> = {};
      for (const row of rows) {
        for (const col of columns) {
          const v = row[col];
          if (typeof v === "string" && v.trim()) m[v] = (m[v] ?? 0) + 1;
        }
      }
      out[section.list] = m;
    }
  } catch {
    // Counts are informational; the page works without them.
  }
  return out;
}

export default async function AdminProfileFieldsPage() {
  const { profile } = await requirePermissionPage("manage_settings");
  const [options, counts, config] = await Promise.all([loadOptions(), loadCounts(), getInvestorMatchConfig()]);
  const hasRows = Object.keys(options).length > 0;

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
        description="The option lists every form offers, and where each one is used. Sections marked as not read by forms yet still use their built in list."
      />

      {!hasRows ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">The lists are not in the database yet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-800">
            Nothing is broken: every form is still rendering its built in list. Apply the vocabulary migrations and this page fills in.
          </p>
        </div>
      ) : (
        <ProfileFieldsManager initial={options} counts={counts} weights={config.engineWeights} />
      )}
    </AppShell>
  );
}
