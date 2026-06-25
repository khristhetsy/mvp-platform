import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";

const LS_API = "https://api.lemonsqueezy.com/v1";

function lsHeaders() {
  return {
    Accept: "application/vnd.api+json",
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
  };
}

async function probe(path: string) {
  try {
    const res = await fetch(`${LS_API}${path}`, { headers: lsHeaders() });
    const body = (await res.text()).slice(0, 400);
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: String(e).slice(0, 400) };
  }
}

/**
 * GET /api/billing/debug — staff-only Lemon Squeezy diagnostic.
 * Reports which env vars are present (never their secret values) and whether the
 * configured API key can authenticate and find the configured variant IDs.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const basicVariant = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC ?? null;
  const proVariant = process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL ?? null;

  const env = {
    apiKey_present: Boolean(process.env.LEMONSQUEEZY_API_KEY),
    storeId_value: process.env.LEMONSQUEEZY_STORE_ID ?? "(not set — auto-detected)",
    basicVariant_value: basicVariant ?? "(missing)",
    proVariant_value: proVariant ?? "(missing)",
    webhookSecret_present: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET),
  };

  const stores = await probe("/stores");
  const basic = basicVariant ? await probe(`/variants/${basicVariant}`) : { skipped: true };
  const pro = proVariant ? await probe(`/variants/${proVariant}`) : { skipped: true };

  return NextResponse.json(
    {
      summary:
        !env.apiKey_present
          ? "❌ LEMONSQUEEZY_API_KEY is not set in this environment."
          : !stores.ok
            ? `❌ API key cannot authenticate / find a store (HTTP ${stores.status}). The key is wrong or from the other mode.`
            : (basic as { ok?: boolean }).ok && (pro as { ok?: boolean }).ok
              ? "✅ Key works and both variant IDs exist for this key's mode. Checkout should work."
              : "❌ Key works, but a variant ID is not found for this key's mode (test vs live mismatch, or wrong ID).",
      env,
      checks: { stores, basicVariant: basic, proVariant: pro },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
