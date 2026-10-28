import { beforeEach, describe, expect, it, vi } from "vitest";

// A small in memory database, so the assignment rules run against real reads and writes.
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  explode: false,
  notifications: [] as Array<Record<string, unknown>>,
  settings: { premiumAccountManagerId: null as string | null },
}));

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: Array<(r: Row) => boolean> = [];
  let deleting = false;
  const match = (r: Row) => filters.every((f) => f(r));
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    limit: () => b,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    delete: () => ((deleting = true), b),
    insert: (row: Row) => {
      rows().push({ ...row });
      return Promise.resolve({ error: null });
    },
    maybeSingle: async () => ({ data: rows().find(match) ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (deleting) {
        db.tables[name] = rows().filter((r) => !match(r));
        return resolve({ error: null });
      }
      return resolve({ data: rows().filter(match), error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => {
    if (db.explode) throw new Error("database down");
    return { from: (t: string) => table(t) };
  },
}));
vi.mock("@/lib/notifications/notifications", () => ({
  createNotification: async (n: Record<string, unknown>) => void db.notifications.push(n),
}));
vi.mock("@/lib/operations/settings", () => ({ getOpsSettings: async () => db.settings }));
vi.mock("@/lib/data/audit", () => ({ writeAuditLog: async () => undefined }));

import { assignAccountManagerForPremium, listAccountManagerIds, setAccountManager } from "@/lib/team/account-manager";

beforeEach(() => {
  db.explode = false;
  db.notifications = [];
  db.settings = { premiumAccountManagerId: "mgr-1" };
  db.tables = {
    companies: [{ id: "c1", company_name: "Acme", founder_id: "f1" }],
    profiles: [
      { id: "mgr-1", role: "admin" },
      { id: "mgr-2", role: "analyst" },
      { id: "adm-1", role: "admin" },
      { id: "f1", role: "founder" },
      { id: "f2", role: "founder" },
    ],
    company_members: [{ company_id: "c1", user_id: "f1", role: "owner" }],
  };
});

describe("setAccountManager", () => {
  it("makes a staff member the one account manager", async () => {
    await setAccountManager({ companyId: "c1", managerId: "mgr-1", assignedBy: null });
    expect(await listAccountManagerIds("c1")).toEqual(["mgr-1"]);
  });

  it("moves the account: the previous manager loses access, the new one gains it", async () => {
    await setAccountManager({ companyId: "c1", managerId: "mgr-1", assignedBy: null });
    await setAccountManager({ companyId: "c1", managerId: "mgr-2", assignedBy: null });
    expect(await listAccountManagerIds("c1")).toEqual(["mgr-2"]);
  });

  it("leaves the Owner alone and clears the manager when asked", async () => {
    await setAccountManager({ companyId: "c1", managerId: "mgr-1", assignedBy: null });
    await setAccountManager({ companyId: "c1", managerId: null, assignedBy: null });
    expect(await listAccountManagerIds("c1")).toEqual([]);
    expect(db.tables.company_members).toEqual([{ company_id: "c1", user_id: "f1", role: "owner" }]);
  });

  it("refuses someone who is not staff", async () => {
    await expect(setAccountManager({ companyId: "c1", managerId: "f2", assignedBy: null })).rejects.toThrow("Choose an iCFO staff member.");
    expect(await listAccountManagerIds("c1")).toEqual([]);
  });

  it("refuses a person who already has another role on the company", async () => {
    db.tables.company_members.push({ company_id: "c1", user_id: "mgr-1", role: "member" });
    await expect(setAccountManager({ companyId: "c1", managerId: "mgr-1", assignedBy: null })).rejects.toThrow("already has another role");
  });
});

describe("assignAccountManagerForPremium", () => {
  it("gives a new Premium account to the default manager and tells them and the admins", async () => {
    expect(await assignAccountManagerForPremium({ founderId: "f1" })).toBe("assigned");
    expect(await listAccountManagerIds("c1")).toEqual(["mgr-1"]);
    const to = db.notifications.map((n) => `${n.recipientUserId}:${n.type}`);
    expect(to).toContain("mgr-1:premium_account_assigned");
    expect(to).toContain("adm-1:premium_account_assigned");
    // the manager is told once, not also as an admin
    expect(to.filter((t) => t.startsWith("mgr-1:")).length).toBe(1);
  });

  it("never replaces an existing account manager", async () => {
    db.tables.company_members.push({ company_id: "c1", user_id: "mgr-2", role: "managed_icfo" });
    expect(await assignAccountManagerForPremium({ founderId: "f1" })).toBe("already_assigned");
    expect(await listAccountManagerIds("c1")).toEqual(["mgr-2"]);
    expect(db.notifications).toEqual([]);
  });

  it("asks the admins to assign one when no default is set", async () => {
    db.settings = { premiumAccountManagerId: null };
    expect(await assignAccountManagerForPremium({ founderId: "f1" })).toBe("needs_manager");
    expect(await listAccountManagerIds("c1")).toEqual([]);
    expect(db.notifications.map((n) => n.type)).toEqual(["premium_needs_account_manager", "premium_needs_account_manager"]);
  });

  it("asks the admins when the default is not staff", async () => {
    db.settings = { premiumAccountManagerId: "f2" };
    expect(await assignAccountManagerForPremium({ founderId: "f1" })).toBe("needs_manager");
    expect(await listAccountManagerIds("c1")).toEqual([]);
  });

  it("does nothing for a founder with no company", async () => {
    expect(await assignAccountManagerForPremium({ founderId: "f2" })).toBe("no_company");
  });

  it("never throws, so a payment is never blocked", async () => {
    db.explode = true;
    expect(await assignAccountManagerForPremium({ founderId: "f1" })).toBe("failed");
  });
});
