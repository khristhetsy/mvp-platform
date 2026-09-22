"use client";

/**
 * The option lists, handed to client pickers.
 *
 * A server component loads them once and wraps the tree. With no provider
 * mounted the hook returns the code lists, so a picker whose page has not been
 * wired yet renders exactly what it renders today rather than coming up empty.
 * That property is what makes this safe to roll out one surface at a time.
 */

import { createContext, useContext, useMemo } from "react";
import {
  CODE_FALLBACK,
  labelOf,
  offered,
  type Vocabularies,
  type VocabularyList,
  type VocabularyOption,
} from "@/lib/vocabulary/lists";

const Ctx = createContext<Vocabularies>(CODE_FALLBACK);

export function VocabularyProvider({
  value,
  children,
}: Readonly<{ value: Vocabularies; children: React.ReactNode }>) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Every list. */
export function useVocabularies(): Vocabularies {
  return useContext(Ctx);
}

/**
 * One list, ready to render.
 *
 * `options` is what to offer — archived values excluded — plus whatever the
 * record already holds, so an answer on a retired value stays visible and is
 * never silently dropped on the next save.
 */
export function useVocabulary(
  list: VocabularyList,
  current?: string | string[] | null,
): { options: VocabularyOption[]; all: VocabularyOption[]; label: (v: string) => string } {
  const all = useContext(Ctx)[list];

  return useMemo(() => {
    const held = Array.isArray(current) ? current : current ? [current] : [];
    const menu = offered(all);
    const extra = all.filter(
      (o) => o.archived && held.some((h) => h === o.slug || h === o.label),
    );
    return {
      options: [...menu, ...extra],
      all,
      label: (v: string) => labelOf(all, v),
    };
  }, [all, current]);
}
