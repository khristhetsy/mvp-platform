/** Small "earn iCFO Points" chip with a hover tooltip. Presentational + server-
 *  safe (no client hooks). Rendered on event surfaces to explain what an action
 *  is worth. Only show when the Points program is enabled. */
export function PointsChip({ points, action = "for this" }: { points: number; action?: string }) {
  return (
    <span className="group relative inline-flex cursor-help items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
      + {points} Points
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-[var(--navy)] px-3 py-2 text-left text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        Earn <b>{points} iCFO Points</b> {action}. Points are redeemable for iCFO services — no cash value. See your balance in your profile.
      </span>
    </span>
  );
}
