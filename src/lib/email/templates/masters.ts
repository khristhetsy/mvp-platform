// Master descriptors (build spec §4). The schemas live in `manifest.json` so a
// single source of truth is shared by the TypeScript runtime (editor form, slot
// merge) and the plain-.mjs `build:emails` script, which cannot import TS.

import manifest from "./manifest.json";
import type { PlaceholderSchema } from "../template-schema";

export type MasterDescriptor = {
  /** Stable key — also the .mjml filename (without extension). */
  slug: string;
  name: string;
  description: string;
  schema: PlaceholderSchema;
};

export const MASTER_DESCRIPTORS = manifest.masters as MasterDescriptor[];
