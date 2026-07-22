import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { getCopyWithMaster } from "@/lib/email/masters-queries";
import { EmailEditorClient } from "./EmailEditorClient";

export const dynamic = "force-dynamic";

export default async function EmailTemplateEditorPage({ params }: { params: Promise<{ copyId: string }> }) {
  await requireRole(["admin"]);
  const { copyId } = await params;
  const copy = await getCopyWithMaster(copyId);
  if (!copy) notFound();

  return <EmailEditorClient copy={copy} />;
}
