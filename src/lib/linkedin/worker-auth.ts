import { NextResponse } from "next/server";
import { accountForKeyHash } from "./worker-store";
import { bearerKey, hashSenderKey } from "./worker";
import type { LinkedInAccount } from "./store";

/** The account behind `Authorization: Bearer lis_...`, or a 401 response. */
export async function requireSender(request: Request): Promise<{ account: LinkedInAccount } | { error: NextResponse }> {
  const key = bearerKey(request.headers.get("authorization"));
  if (!key) return { error: NextResponse.json({ error: "Missing sender key." }, { status: 401 }) };
  const account = await accountForKeyHash(hashSenderKey(key));
  if (!account) return { error: NextResponse.json({ error: "Unknown sender key." }, { status: 401 }) };
  return { account };
}
