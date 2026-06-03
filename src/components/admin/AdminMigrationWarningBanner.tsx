import Link from "next/link";
import type { MigrationVerificationResult } from "@/lib/operations/migration-verification";

export function AdminMigrationWarningBanner({
  migrations,
}: Readonly<{ migrations: MigrationVerificationResult }>) {
  if (migrations.ok || migrations.verificationUnavailable) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Migration verification failed</p>
      <p className="mt-1 leading-6">
        Required floor <code className="rounded bg-amber-100 px-1 text-xs">{migrations.floor}</code> is not confirmed
        on this database. {migrations.detail}
      </p>
      <p className="mt-2 text-xs text-amber-900">
        Repo latest: {migrations.repoLatest ?? "unknown"} · Applied latest:{" "}
        {migrations.appliedLatest ?? (migrations.databaseQueryable ? "none" : "not queried")}
      </p>
      <Link href="/admin/system-health" className="mt-2 inline-block text-xs font-semibold text-amber-900 underline">
        Review launch readiness
      </Link>
    </div>
  );
}
