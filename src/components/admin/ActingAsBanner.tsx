import { getActingFounderProfile } from "@/lib/admin/act-on-behalf";
import { StopActingButton } from "@/components/admin/StopActingButton";

/**
 * Persistent banner shown whenever a staff member is acting on a founder's
 * behalf. Server component — resolves the guarded acting context; renders nothing
 * when there's no active session. Drop into founder shells so the warning is
 * always visible while impersonating.
 */
export async function ActingAsBanner() {
  const founder = await getActingFounderProfile();
  if (!founder) return null;
  const name = founder.full_name ?? founder.email ?? "this founder";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2">
      <i className="ti ti-user-shield text-amber-700" aria-hidden="true" />
      <p className="text-xs font-medium text-amber-900">
        Acting as {name} — changes save to the founder&apos;s account and are logged under your name.
      </p>
      <div className="ml-auto">
        <StopActingButton />
      </div>
    </div>
  );
}
