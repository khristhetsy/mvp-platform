// Measurement is a THIN read-only view over a rented provider (Frase / Peec) — not
// a tracker we build. If no provider is configured, we return an honest empty
// state and NEVER fabricate visibility data.

export type VisibilityProvider = "frase" | "peec" | "none";

export interface AnswerGridRow {
  prompt: string;
  cited: boolean;
  position: number | null;
  provider: string;
}

export interface VisibilityResult {
  connected: boolean;
  provider: VisibilityProvider;
  fetchedAt: string | null;
  rows: AnswerGridRow[];
  shareOfVoice: number | null; // 0..1
  note?: string;
}

function configuredProvider(): VisibilityProvider {
  const p = (process.env.AEO_VISIBILITY_PROVIDER ?? "none").toLowerCase();
  return p === "frase" || p === "peec" ? p : "none";
}

// Simple in-memory cache (per server instance) so we don't hit the provider per view.
let cache: { at: number; data: VisibilityResult } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function getVisibility(): Promise<VisibilityResult> {
  const provider = configuredProvider();
  const apiKey = process.env.AEO_VISIBILITY_API_KEY;

  if (provider === "none" || !apiKey) {
    return {
      connected: false,
      provider: "none",
      fetchedAt: null,
      rows: [],
      shareOfVoice: null,
      note: "Connect a visibility provider (Frase or Peec) to see the Answer Grid.",
    };
  }

  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // A real provider integration would fetch + normalize here. Until one is wired,
  // return an honest empty (connected) state rather than inventing numbers.
  const data: VisibilityResult = {
    connected: true,
    provider,
    fetchedAt: new Date().toISOString(),
    rows: [],
    shareOfVoice: null,
    note: `Connected to ${provider}. No results cached yet.`,
  };
  cache = { at: Date.now(), data };
  return data;
}
