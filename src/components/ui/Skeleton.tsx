export function Skeleton({
  className = "",
}: Readonly<{ className?: string }>) {
  return <div className={`enterprise-skeleton ${className}`} aria-hidden />;
}

export function MetricSkeletonRow() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder rows for a loading message/contact/record list. */
export function ListRowsSkeleton({ rows = 6 }: Readonly<{ rows?: number }>) {
  return (
    <ul aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-40 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </li>
      ))}
    </ul>
  );
}
