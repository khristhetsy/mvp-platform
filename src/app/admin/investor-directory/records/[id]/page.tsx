import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { RecordEditor } from "@/components/admin/investor-directory/RecordEditor";
import { getRecord } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

export default async function InvestorDirectoryRecordPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  await requireRole(["admin"]);
  const { id } = await params;
  const record = await getRecord(id);
  if (!record) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
      <Link href="/admin/investor-directory/verification" className="text-[12.5px] text-slate-500 hover:text-slate-700">← Verification queue</Link>
      <RecordEditor record={record} />
    </div>
  );
}
