import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { getOrCreateAccount } from "@/lib/linkedin/store";
import { issueSenderKey, revokeSenderKey } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

/** POST: create or replace the sender key. The key is returned once and never stored in clear. */
export async function POST() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    return NextResponse.json({ key: await issueSenderKey(account.id, auth.profile.id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create the key." }, { status: 500 });
  }
}

/** DELETE: remove the key. The sender stops working at once. */
export async function DELETE() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    await revokeSenderKey(account.id, auth.profile.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not remove the key." }, { status: 500 });
  }
}
