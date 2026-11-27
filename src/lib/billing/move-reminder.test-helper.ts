// In-memory stand-in for the Supabase query builder, covering what the move reminder reads and
// writes: select with eq / in / is / not-is-null / gt / lte / limit / maybeSingle, and insert.

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

const time = (v: unknown) => Date.parse(String(v));

class Query implements PromiseLike<Result> {
  private filters: Array<(r: Row) => boolean> = [];
  private payload: Row | Row[] | null = null;
  private single = false;
  private max: number | null = null;

  constructor(private db: MoveReminderFakeDb, private table: string) {}

  select() { return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  in(k: string, v: unknown[]) { this.filters.push((r) => v.includes(r[k])); return this; }
  is(k: string, v: unknown) { this.filters.push((r) => (r[k] ?? null) === v); return this; }
  not(k: string, op: string, v: unknown) { if (op === "is" && v === null) this.filters.push((r) => r[k] != null); return this; }
  gt(k: string, v: unknown) { this.filters.push((r) => r[k] != null && time(r[k]) > time(v)); return this; }
  lte(k: string, v: unknown) { this.filters.push((r) => r[k] != null && time(r[k]) <= time(v)); return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(p: Row | Row[]) { this.payload = p; return this; }

  private run(): Result {
    if (this.db.failTables.has(this.table)) return { data: null, error: { message: `could not read ${this.table}` } };
    const all = this.db.rows(this.table);
    if (this.payload) {
      for (const r of Array.isArray(this.payload) ? this.payload : [this.payload]) all.push({ ...r });
      return { data: null, error: null };
    }
    const rows = all.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max ?? undefined);
    return { data: this.single ? rows[0] ?? null : rows.map((r) => ({ ...r })), error: null };
  }

  then<A, B>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(ok, bad);
  }
}

export class MoveReminderFakeDb {
  tables: Record<string, Row[]> = {};
  failTables = new Set<string>();

  rows(t: string): Row[] {
    return (this.tables[t] ??= []);
  }

  from(table: string) {
    return new Query(this, table);
  }

  events(action: string): Row[] {
    return this.rows("audit_logs").filter((r) => r.action === action);
  }
}

export const NOW = new Date("2026-11-25T17:00:00.000Z");
export const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Seeds one customer: a profile and its subscription. Defaults to an eligible $49 Basic customer renewing in 3 days. */
export function seedCustomer(
  db: MoveReminderFakeDb,
  sub: Row = {},
  profile: Row = {},
): { subscriptionId: string; profileId: string; email: string } {
  const profileId = uuid();
  const subscriptionId = uuid();
  const email = `founder${n}@example.com`;
  db.rows("profiles").push({ id: profileId, email, full_name: "Jane Doe", role: "founder", ...profile });
  db.rows("subscriptions").push({
    id: subscriptionId,
    profile_id: profileId,
    plan_type: "founder_basic",
    subscription_status: "active",
    ls_subscription_id: `ls_${n}`,
    ls_variant_id: "111",
    stripe_subscription_id: null,
    stripe_customer_id: null,
    cancel_at_period_end: false,
    grace_period_ends_at: null,
    current_period_end: inDays(3),
    monthly_price_cents: 4900,
    ...sub,
  });
  return { subscriptionId, profileId, email: String(profile.email ?? email) };
}
