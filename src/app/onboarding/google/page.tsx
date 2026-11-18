import Link from "next/link";
import { redirect } from "next/navigation";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { GOOGLE_STEP_PATH, afterGoogleStepPath } from "@/lib/onboarding/google-step";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GoogleStepPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const profile = await requireRole(["founder", "investor"]);
  const { google } = await searchParams;
  const target = afterGoogleStepPath(profile.role);

  const supabase = await createServerSupabaseClient();
  const status = await getGoogleConnectionStatus(supabase, profile.id);

  // Already connected, or Google is not set up on this deployment: nothing to ask.
  if (status.connected || !status.configured) redirect(target);

  const connectHref = `/api/integrations/google/connect?returnTo=${encodeURIComponent(GOOGLE_STEP_PATH)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">One more step</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Connect your Google account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Connecting Google lets iCapOS create a Google Meet link and a calendar event when someone books time with you,
          including investors you meet at events. You can also do this later in Settings.
        </p>
        {google === "error" ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Google did not connect. You can try again or skip for now.
          </p>
        ) : null}
        <a
          href={connectHref}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Connect Google
        </a>
        <Link href={target} className="mt-3 block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
          Skip for now
        </Link>
      </div>
    </div>
  );
}
