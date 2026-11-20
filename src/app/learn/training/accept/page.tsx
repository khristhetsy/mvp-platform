import { redirect } from "next/navigation";
import { AcceptInviteClient } from "@/components/training/AcceptInviteClient";
import { requireUserProfile } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AcceptStaffTrainingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/learn/training");
  // requireUserProfile sends signed out visitors to sign in.
  await requireUserProfile();
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold text-[#0A1A40]">Your training invitation</h1>
      <p className="mb-6 mt-2 text-sm text-slate-600">Accept to open your course. The link works once.</p>
      <AcceptInviteClient token={token} />
    </main>
  );
}
