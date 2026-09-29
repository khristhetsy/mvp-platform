import { AppShell } from "@/components/AppShell";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";

/**
 * Guarantees admin workspace chrome (sidebar + header) on every /admin/* route,
 * and hands every picker below it the option lists.
 *
 * Server component so the lists can be read once per request rather than by
 * each editor that needs them. The loader is cached and never throws — a
 * failure falls back to the code lists, so the worst case is the chrome and
 * every form rendering exactly as they did before the table existed.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <VocabularyProvider value={await loadVocabularies()}>
      <AppShell workspace="admin">{children}</AppShell>
    </VocabularyProvider>
  );
}
