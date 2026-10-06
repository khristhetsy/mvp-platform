// In-memory stand-in for the Supabase query builder, for contact finder tests.
// Supports the subset the finder uses: select/eq/neq/in/gte/lt/not/or/order/
// limit/range/maybeSingle/single, insert/upsert/update, head counts. `or` filters
// are ignored (callers' or-filters only narrow; tests seed rows accordingly).

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  failTables = new Set<string>();
  /** Columns that "don't exist yet" (migration not applied): selecting or writing them errors. */
  failColumns = new Set<string>();

  rows(t: string): Row[] {
    return (this.tables[t] ??= []);
  }

  from(table: string) {
    return new Query(this, table);
  }
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: Filter[] = [];
  private op: "select" | "update" | "insert" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private opts: { onConflict?: string; ignoreDuplicates?: boolean; head?: boolean; count?: string } = {};
  private lim: number | null = null;
  private off = 0;
  private single: "maybe" | "one" | null = null;
  private cols = "";

  constructor(private db: FakeDb, private table: string) {}

  select(cols?: string, o?: { count?: string; head?: boolean }) { this.cols = cols ?? ""; if (o) Object.assign(this.opts, o); return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, v: unknown[]) { this.filters.push((r) => v.includes(r[k])); return this; }
  gte(k: string, v: unknown) { this.filters.push((r) => (r[k] as number | string) >= (v as number | string)); return this; }
  lt(k: string, v: unknown) { this.filters.push((r) => r[k] != null && (r[k] as number | string) < (v as number | string)); return this; }
  not(k: string, op: string, v: unknown) { if (op === "is" && v === null) this.filters.push((r) => r[k] != null); return this; }
  or() { return this; }
  ilike() { return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
  maybeSingle() { this.single = "maybe"; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert(p: any) { this.op = "insert"; this.payload = p; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert(p: any, o?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = "upsert"; this.payload = p; Object.assign(this.opts, o ?? {}); return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(p: any) { this.op = "update"; this.payload = p; return this; }

  private run(): { data: unknown; error: unknown; count?: number } {
    if (this.db.failTables.has(this.table)) return { data: null, error: { message: `relation "${this.table}" does not exist` } };
    const touched = [
      ...this.cols.split(",").map((c) => c.trim()),
      ...(this.payload ? (Array.isArray(this.payload) ? this.payload : [this.payload]).flatMap((r) => Object.keys(r)) : []),
    ];
    const missing = touched.find((c) => this.db.failColumns.has(c));
    if (missing) return { data: null, error: { message: `column ${this.table}.${missing} does not exist` } };
    const all = this.db.rows(this.table);
    const match = () => all.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const r of list) all.push({ id: `id-${all.length + 1}`, created_at: new Date().toISOString(), ...r });
      return { data: null, error: null };
    }
    if (this.op === "upsert") {
      const keys = (this.opts.onConflict ?? "id").split(",");
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const r of list) {
        const hit = all.find((x) => keys.every((k) => x[k] === r[k]));
        if (hit) { if (!this.opts.ignoreDuplicates) Object.assign(hit, r); }
        else all.push({ id: `id-${all.length + 1}`, created_at: new Date().toISOString(), status: this.table === "contact_finder_suggestions" ? "pending" : undefined, ...r });
      }
      return { data: null, error: null };
    }
    if (this.op === "update") {
      for (const r of match()) Object.assign(r, this.payload);
      return { data: null, error: null };
    }
    let rows = match();
    const count = rows.length;
    rows = rows.slice(this.off, this.lim == null ? undefined : this.off + this.lim);
    if (this.opts.head) return { data: null, error: null, count };
    if (this.single) return { data: rows[0] ?? null, error: null };
    return { data: rows.map((r) => ({ ...r })), error: null, count };
  }

  then<A, B>(ok?: ((v: { data: unknown; error: unknown; count?: number }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(ok, bad);
  }
}
