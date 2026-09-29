"use client";

/**
 * Shown and Required for one screen, handed to deeply nested client editors.
 *
 * With no provider mounted every field is shown, which is what each screen did
 * before Admin, Profile and fields could hide one.
 */

import { createContext, useContext } from "react";
import type { ResolvedSurface } from "@/lib/profile-fields/display";

const Ctx = createContext<ResolvedSurface | null>(null);

export function FieldDisplayProvider({ value, children }: Readonly<{ value: ResolvedSurface; children: React.ReactNode }>) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Whether a managed field is shown on this screen. Unmanaged keys are always shown. */
export function useFieldShown(): (key: string) => boolean {
  const v = useContext(Ctx);
  return (key: string) => v?.[key]?.shown !== false;
}
