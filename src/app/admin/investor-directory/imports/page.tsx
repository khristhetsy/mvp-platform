import { requireRole } from "@/lib/supabase/auth";
import { ImportsClient } from "@/components/admin/investor-directory/ImportsClient";
import { listImports } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export default async function InvestorDirectoryImportsPage({ searchParams }: Readonly<{ searchParams: Promise<{ new?: string }> }>) {
  await requireRole(["admin"]);
  const [imports, sp] = await Promise.all([listImports(), searchParams]);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Imports</h1>
      <ImportsClient imports={imports} openNew={sp.new === "1"} />
    </div>
  );
}
