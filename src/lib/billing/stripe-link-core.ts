// Pure matching for the one off pass that links a Stripe subscription created outside our
// checkout (Lemon Squeezy's migration tool) to the iCapOS subscriptions row it belongs to.
//
// The match is on the Lemon Squeezy subscription id, which is unique on subscriptions
// (supabase/migrations/0075_lemonsqueezy_billing.sql). Once the Stripe ids are on the row,
// the Stripe webhook finds it through its own stripe_subscription_id lookup.
//
// Kept free of the database and of both providers so the route and the tests share one
// definition of matched, unmatched, already linked and conflict.

/** One line of the input list. Lemon's own file format is mapped onto this by a later adapter. */
export type StripeLinkInput = {
  ls_subscription_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
};

/** The columns of a subscriptions row the matcher reads. */
export type StripeLinkRow = {
  id: string;
  profile_id: string | null;
  plan_type: string | null;
  subscription_status: string | null;
  ls_subscription_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
};

export type StripeLinkStatus = "matched" | "unmatched" | "already_linked" | "conflict";

export type StripeLinkOutcome = StripeLinkInput & {
  status: StripeLinkStatus;
  /** Why, in plain words. Always set for unmatched and conflict. */
  reason: string | null;
  /** The subscriptions row the Lemon id (or, on a rerun, the Stripe id) belongs to. */
  subscription_id: string | null;
  profile_id: string | null;
  plan_type: string | null;
  subscription_status: string | null;
};

export type InvalidStripeLinkInput = { index: number; reason: string; row: unknown };

export type ParsedStripeLinkInputs = {
  rows: StripeLinkInput[];
  invalid: InvalidStripeLinkInput[];
  /** Set when the body is not a list at all, or is too long to run in one pass. */
  error: string | null;
};

/** One pass reads and writes row by row, so keep it well inside a function's time limit. */
export const STRIPE_LINK_MAX_ROWS = 500;

const STRIPE_SUBSCRIPTION = /^sub_[A-Za-z0-9]+$/;
const STRIPE_CUSTOMER = /^cus_[A-Za-z0-9]+$/;

/** Lemon ids arrive as numbers in some exports and as strings in others. Both are accepted. */
function text(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Read the request body into input rows. Accepts the list itself or `{ rows: [...] }`.
 *
 * A row is refused, and never written, when a field is missing or is not the kind of id
 * it claims to be. An id repeated across rows is not judged here: matchStripeLinks
 * returns every row involved as a conflict.
 */
export function parseStripeLinkInputs(body: unknown): ParsedStripeLinkInputs {
  const list = Array.isArray(body) ? body : (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(list)) {
    return { rows: [], invalid: [], error: "Send a JSON list of { ls_subscription_id, stripe_subscription_id, stripe_customer_id }." };
  }
  if (list.length > STRIPE_LINK_MAX_ROWS) {
    return { rows: [], invalid: [], error: `Send at most ${STRIPE_LINK_MAX_ROWS} rows in one pass (got ${list.length}).` };
  }

  const invalid: InvalidStripeLinkInput[] = [];
  const candidates: Array<{ row: StripeLinkInput }> = [];

  list.forEach((raw, index) => {
    const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const row: StripeLinkInput = {
      ls_subscription_id: text(source.ls_subscription_id),
      stripe_subscription_id: text(source.stripe_subscription_id),
      stripe_customer_id: text(source.stripe_customer_id),
    };
    const problems: string[] = [];
    if (!row.ls_subscription_id) problems.push("ls_subscription_id is missing");
    if (!STRIPE_SUBSCRIPTION.test(row.stripe_subscription_id)) problems.push("stripe_subscription_id must look like sub_...");
    if (!STRIPE_CUSTOMER.test(row.stripe_customer_id)) problems.push("stripe_customer_id must look like cus_...");
    if (problems.length > 0) invalid.push({ index, reason: problems.join("; "), row: raw });
    else candidates.push({ row });
  });

  const rows = candidates.map((c) => c.row);
  return { rows, invalid, error: null };
}

export type StripeLinkLookup = {
  /** The row holding this Lemon subscription id, if any. */
  byLemon: StripeLinkRow | null;
  /** The row already holding this Stripe subscription id, if any. */
  byStripeSubscription: StripeLinkRow | null;
  /** The row already holding this Stripe customer id, if any. */
  byStripeCustomer: StripeLinkRow | null;
};

function outcome(input: StripeLinkInput, status: StripeLinkStatus, reason: string | null, row: StripeLinkRow | null): StripeLinkOutcome {
  return {
    ...input,
    status,
    reason,
    subscription_id: row?.id ?? null,
    profile_id: row?.profile_id ?? null,
    plan_type: row?.plan_type ?? null,
    subscription_status: row?.subscription_status ?? null,
  };
}

/**
 * Decide what one input row means against what the database holds.
 *
 * - matched: the Lemon id is on a row with no Stripe subscription yet. Safe to write.
 * - already_linked: the row already carries exactly these Stripe ids, or the Stripe
 *   webhook has since synced it and cleared the Lemon id. Nothing to write.
 * - conflict: the row, or another row, already holds a different Stripe id. Never written.
 * - unmatched: no row holds this Lemon id or this Stripe subscription id.
 */
export function classifyStripeLink(input: StripeLinkInput, found: StripeLinkLookup): StripeLinkOutcome {
  const row = found.byLemon;

  if (!row) {
    const synced = found.byStripeSubscription;
    if (!synced) return outcome(input, "unmatched", "No subscription row holds this Lemon Squeezy subscription id.", null);
    if (synced.ls_subscription_id && synced.ls_subscription_id !== input.ls_subscription_id) {
      return outcome(input, "conflict", `This Stripe subscription is already on a row with a different Lemon Squeezy id (${synced.ls_subscription_id}).`, synced);
    }
    return outcome(input, "already_linked", "The Stripe subscription is on a row whose Lemon Squeezy id has already been cleared by the Stripe webhook.", synced);
  }

  if (found.byStripeSubscription && found.byStripeSubscription.id !== row.id) {
    return outcome(input, "conflict", "This Stripe subscription is already on a different subscription row.", row);
  }
  if (found.byStripeCustomer && found.byStripeCustomer.id !== row.id) {
    return outcome(input, "conflict", "This Stripe customer is already on a different subscription row.", row);
  }
  if (row.stripe_subscription_id && row.stripe_subscription_id !== input.stripe_subscription_id) {
    return outcome(input, "conflict", `The row already has a different Stripe subscription (${row.stripe_subscription_id}).`, row);
  }
  if (row.stripe_customer_id && row.stripe_customer_id !== input.stripe_customer_id) {
    return outcome(input, "conflict", `The row already has a different Stripe customer (${row.stripe_customer_id}).`, row);
  }
  if (row.stripe_subscription_id === input.stripe_subscription_id && row.stripe_customer_id === input.stripe_customer_id) {
    return outcome(input, "already_linked", null, row);
  }
  return outcome(input, "matched", null, row);
}

/**
 * Why an input row cannot be trusted because of another row in the same list, or null.
 *
 * A repeated Lemon Squeezy id or Stripe subscription id cannot be right for both rows.
 * A repeated Stripe customer is refused as well: subscriptions.stripe_customer_id is
 * unique (supabase/migrations/0070_stripe_billing.sql), so one customer can never be
 * written onto two rows, and the list alone cannot say which row is the intended one.
 */
function duplicateReasons(inputs: StripeLinkInput[]): Array<string | null> {
  const count = (key: keyof StripeLinkInput) => {
    const seen = new Map<string, number>();
    for (const input of inputs) seen.set(input[key], (seen.get(input[key]) ?? 0) + 1);
    return seen;
  };
  const lemon = count("ls_subscription_id");
  const stripeSubscription = count("stripe_subscription_id");
  const stripeCustomer = count("stripe_customer_id");

  return inputs.map((input) => {
    const reasons: string[] = [];
    if ((stripeSubscription.get(input.stripe_subscription_id) ?? 0) > 1) {
      reasons.push("This Stripe subscription appears more than once in the input.");
    }
    if ((lemon.get(input.ls_subscription_id) ?? 0) > 1) {
      reasons.push("This Lemon Squeezy subscription id appears more than once in the input.");
    }
    if ((stripeCustomer.get(input.stripe_customer_id) ?? 0) > 1) {
      reasons.push("This Stripe customer appears more than once in the input. A Stripe customer can be on one subscription row only, so it is not safe to link any of the rows that share it.");
    }
    return reasons.length > 0 ? reasons.join(" ") : null;
  });
}

/**
 * Classify every input row against the rows loaded for the whole list.
 *
 * Duplicates inside the list are found first: every row involved in one is a conflict,
 * whatever the database holds, so one Stripe id can never be written onto two rows.
 */
export function matchStripeLinks(inputs: StripeLinkInput[], rows: StripeLinkRow[]): StripeLinkOutcome[] {
  const byLemon = new Map<string, StripeLinkRow>();
  const byStripeSubscription = new Map<string, StripeLinkRow>();
  const byStripeCustomer = new Map<string, StripeLinkRow>();
  for (const row of rows) {
    if (row.ls_subscription_id) byLemon.set(row.ls_subscription_id, row);
    if (row.stripe_subscription_id) byStripeSubscription.set(row.stripe_subscription_id, row);
    if (row.stripe_customer_id) byStripeCustomer.set(row.stripe_customer_id, row);
  }
  const duplicated = duplicateReasons(inputs);
  return inputs.map((input, index) => {
    const reason = duplicated[index];
    if (reason) return outcome(input, "conflict", reason, byLemon.get(input.ls_subscription_id) ?? null);
    return classifyStripeLink(input, {
      byLemon: byLemon.get(input.ls_subscription_id) ?? null,
      byStripeSubscription: byStripeSubscription.get(input.stripe_subscription_id) ?? null,
      byStripeCustomer: byStripeCustomer.get(input.stripe_customer_id) ?? null,
    });
  });
}

/**
 * The outcomes apply may write: matched rows with a known subscriptions row, each Stripe
 * subscription, Stripe customer and subscriptions row at most once. Anything else
 * (conflict, unmatched, already linked) is never written, whatever the caller passes in.
 */
export function stripeLinksToWrite(outcomes: StripeLinkOutcome[]): StripeLinkOutcome[] {
  const seen = new Set<string>();
  const writable: StripeLinkOutcome[] = [];
  for (const o of outcomes) {
    if (o.status !== "matched" || !o.subscription_id) continue;
    const keys = [`row:${o.subscription_id}`, `sub:${o.stripe_subscription_id}`, `cus:${o.stripe_customer_id}`];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    writable.push(o);
  }
  return writable;
}
