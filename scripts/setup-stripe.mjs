/**
 * Run once to create Stripe products + prices for CapitalOS.
 * Usage: node scripts/setup-stripe.mjs
 */
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌  Set STRIPE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });

async function createPlan(role, tier, amount) {
  const name = `CapitalOS ${role} ${tier}`;
  const product = await stripe.products.create({
    name,
    metadata: { role: role.toLowerCase(), tier: tier.toLowerCase() },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount * 100, // cents
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { role: role.toLowerCase(), tier: tier.toLowerCase() },
  });

  return { product: product.id, price: price.id, name, amount };
}

console.log("Creating Stripe products...\n");

const plans = await Promise.all([
  createPlan("Founder", "Pro", 500),
  createPlan("Founder", "Premium", 1000),
  createPlan("Investor", "Pro", 500),
  createPlan("Investor", "Premium", 1000),
]);

console.log("✅  Done! Add these to your .env.local and Vercel env vars:\n");
for (const { name, price, amount } of plans) {
  const key = name
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
  console.log(`STRIPE_PRICE_${key}=${price}   # $${amount}/mo`);
}
