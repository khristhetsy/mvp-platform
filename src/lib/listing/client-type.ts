/**
 * Company client type: "standard" or "spv". Separate from the Deal Company
 * account type (organizations.type = "spv"). Only SPV clients show a raise
 * amount to investors. Pure helpers here; the route and loaders do the I/O.
 */
export const CLIENT_TYPES = ["standard", "spv"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export function normalizeClientType(value: unknown): ClientType {
  return value === "spv" ? "spv" : "standard";
}

export function isSpvClient(value: unknown): boolean {
  return normalizeClientType(value) === "spv";
}

/** The raise amount investors may see: only for SPV clients, otherwise null. */
export function raiseForInvestors<T extends string | number | null | undefined>(
  clientType: unknown,
  raise: T,
): T | null {
  return isSpvClient(clientType) ? raise : null;
}

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  standard: "Standard",
  spv: "SPV client",
};

/**
 * One company's client type, read on its own so the pages and emails that use
 * it keep working before the client_type migration is applied. Any error reads
 * as Standard, which hides the raise amount, the safe side.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchClientType(db: any, companyId: string): Promise<ClientType> {
  try {
    const { data } = await db.from("companies").select("client_type").eq("id", companyId).maybeSingle();
    return normalizeClientType((data as { client_type?: string | null } | null)?.client_type);
  } catch {
    return "standard";
  }
}
