"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BookOpen, Lock, Search, AlertTriangle } from "lucide-react";
import { SOP_PARTS, sopAnchor } from "@/lib/admin-sop/types";
import type { SopEntry, SopPartId } from "@/lib/admin-sop/types";
import { INTERNAL_PERMISSION_LABELS } from "@/lib/rbac/constants";

type Entry = { sop: SopEntry; locked: boolean };

function permissionLabel(sop: SopEntry): string {
  if (!sop.permission) return "General staff";
  return INTERNAL_PERMISSION_LABELS[sop.permission] ?? sop.permission;
}

export function AdminManualClient({ entries }: { entries: Entry[] }) {
  const t = useTranslations("adminCmp");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(({ sop }) => {
      return (
        sop.title.toLowerCase().includes(q) ||
        sop.summary.toLowerCase().includes(q) ||
        sop.keywords.some((k) => k.toLowerCase().includes(q)) ||
        String(sop.id) === q
      );
    });
  }, [entries, search]);

  const byPart = useMemo(() => {
    const map = new Map<SopPartId, Entry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.sop.part) ?? [];
      list.push(entry);
      map.set(entry.sop.part, list);
    }
    return map;
  }, [filtered]);

  const activeParts = SOP_PARTS.filter((p) => (byPart.get(p.id)?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin_internal")}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <BookOpen className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
          Operations manual
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Standard operating procedures for running the platform. You see the procedures your role can perform; ones you
          can&apos;t are marked locked. Ask the assistant &ldquo;how do I…&rdquo; to jump straight to a procedure.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_procedures")}
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-[var(--blue)] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        {/* Section nav */}
        <nav className="hidden self-start lg:block lg:sticky lg:top-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Parts</p>
          <ul className="space-y-1 text-sm">
            {activeParts.map((part) => (
              <li key={part.id}>
                <a href={`#part-${part.id}`} className="block rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {part.id} · {part.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Procedures */}
        <div className="space-y-6">
          {activeParts.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_procedures_match_your_search")}</p>
          ) : (
            activeParts.map((part) => (
              <section key={part.id} id={`part-${part.id}`} className="scroll-mt-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Part {part.id} · {part.title}
                </h2>
                <div className="space-y-3">
                  {(byPart.get(part.id) ?? []).map(({ sop, locked }) => (
                    <article
                      key={sop.id}
                      id={sopAnchor(sop.id)}
                      className="scroll-mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">SOP {sop.id}</p>
                          <h3 className="text-base font-semibold text-slate-950">{sop.title}</h3>
                          <p className="mt-0.5 text-sm text-slate-600">{sop.summary}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {sop.planned ? (
                            <span className="rounded-md bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#0C447C]">{t("planned")}</span>
                          ) : null}
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              locked ? "bg-[#F1EFE8] text-[#444441]" : "bg-[#EEEDFE] text-[#3C3489]"
                            }`}
                          >
                            {locked ? <Lock className="h-3 w-3" /> : null}
                            {permissionLabel(sop)}
                          </span>
                        </div>
                      </div>

                      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                        {sop.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>

                      {sop.behindScenes ? (
                        <p className="mt-3 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{t("behind_the_scenes")}</span> {sop.behindScenes}
                        </p>
                      ) : null}
                      {sop.reversibility ? (
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{t("reversibility")}</span> {sop.reversibility}
                        </p>
                      ) : null}

                      {sop.warnings && sop.warnings.length > 0 ? (
                        <div className="mt-3 rounded-lg border-l-2 border-[#E4C77A] bg-[#FBF4E2] px-3 py-2">
                          {sop.warnings.map((w, i) => (
                            <p key={i} className="flex items-start gap-1.5 text-xs text-[#7A5409]">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{w}</span>
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {locked ? (
                        <p className="mt-3 text-xs text-slate-400">
                          You don&apos;t have permission to perform this — escalate to someone with {permissionLabel(sop)} access.
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
