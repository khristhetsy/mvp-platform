import Link from "next/link";
import type { WorkflowDependency } from "@/lib/automation/types";

export function WorkflowDependencyPanel({
  dependencies,
  title = "Workflow dependencies",
}: Readonly<{
  dependencies: WorkflowDependency[];
  title?: string;
}>) {
  const unresolved = dependencies.filter((d) => !d.resolved);
  if (unresolved.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{title}</p>
      <p className="mt-1 text-xs text-amber-800/90">Blocked by unresolved dependencies — operational view only.</p>
      <ul className="mt-3 space-y-2">
        {unresolved.map((dep) => (
          <li key={dep.id} className="rounded-lg border border-amber-100 bg-white/60 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[var(--navy)]">{dep.blocker}</span>
              <span className="rounded-full border border-amber-200 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                {dep.severity}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{dep.dependency}</p>
            <p className="mt-1 text-xs font-medium text-amber-950">Next: {dep.nextRequiredStep}</p>
            {dep.href ? (
              <Link href={dep.href} className="mt-1 inline-block text-xs font-semibold text-indigo-700 hover:underline">
                Open related workflow
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
