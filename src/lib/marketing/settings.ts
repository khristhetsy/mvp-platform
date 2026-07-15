import { marketingDb } from "./db";

export type SenderAddress = { name: string; email: string };

export type MarketingSettings = {
  default_from_name: string;
  default_from_email: string;
  default_reply_to: string | null;
  senders: SenderAddress[]; // approved From addresses for the campaign dropdown
};

export const MARKETING_SETTINGS_DEFAULTS: MarketingSettings = {
  default_from_name: "iCapOS",
  default_from_email: "outreach@icapos.com",
  default_reply_to: null,
  senders: [],
};

function parseSenders(raw: unknown): SenderAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: SenderAddress[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const email = String((r as { email?: unknown })?.email ?? "").trim();
    const name = String((r as { name?: unknown })?.name ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name || email, email });
  }
  return out.slice(0, 25);
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  try {
    const db = marketingDb();
    const { data } = await db.from("marketing_settings").select("default_from_name, default_from_email, default_reply_to, senders").eq("id", "default").maybeSingle();
    if (!data) return MARKETING_SETTINGS_DEFAULTS;
    return {
      default_from_name: (data.default_from_name as string) || MARKETING_SETTINGS_DEFAULTS.default_from_name,
      default_from_email: (data.default_from_email as string) || MARKETING_SETTINGS_DEFAULTS.default_from_email,
      default_reply_to: (data.default_reply_to as string) ?? null,
      senders: parseSenders((data as { senders?: unknown }).senders),
    };
  } catch {
    return MARKETING_SETTINGS_DEFAULTS;
  }
}

export async function updateMarketingSettings(patch: Partial<MarketingSettings>): Promise<void> {
  const db = marketingDb();
  const update: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
  if (patch.default_from_name !== undefined) update.default_from_name = patch.default_from_name.trim() || "iCapOS";
  if (patch.default_from_email !== undefined) update.default_from_email = patch.default_from_email.trim();
  if (patch.default_reply_to !== undefined) update.default_reply_to = patch.default_reply_to?.trim() || null;
  if (patch.senders !== undefined) update.senders = parseSenders(patch.senders);
  const { error } = await db.from("marketing_settings").upsert(update, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
