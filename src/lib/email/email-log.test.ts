import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: unknown[] = [];
const profiles = [
  { id: "11111111-1111-1111-1111-111111111111", email: "maya@northstar.com", role: "founder" },
  { id: "22222222-2222-2222-2222-222222222222", email: "sam@harbor.vc", role: "investor" },
  { id: "33333333-3333-3333-3333-333333333333", email: "kthetsy@myicfos.com", role: "admin" },
];

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        const q = {
          select: () => q,
          in: (_c: string, emails: string[]) => Promise.resolve({ data: profiles.filter((p) => emails.includes(p.email)) }),
          eq: (_c: string, id: string) => ({ maybeSingle: () => Promise.resolve({ data: profiles.find((p) => p.id === id) ?? null }) }),
        };
        return q;
      }
      return {
        insert: (rows: unknown[]) => { inserted.push(...rows); return Promise.resolve({ error: null }); },
        delete: () => ({ lt: () => Promise.resolve({}) }),
      };
    },
  }),
}));
vi.mock("next/headers", () => ({ cookies: () => { throw new Error("no request"); } }));

import { logOutboundEmail, roleFor, sourceFromStack, userIdFromAuthCookies } from "./email-log";
import { emailResult, sourceLabel } from "./email-log-labels";
import { runInJob } from "@/lib/cron/job-context";

beforeEach(() => { inserted.length = 0; });

describe("roleFor", () => {
  it("groups platform roles", () => {
    expect(roleFor("founder")).toBe("founder");
    expect(roleFor("investor")).toBe("investor");
    expect(roleFor("admin")).toBe("staff");
    expect(roleFor("analyst")).toBe("staff");
    expect(roleFor(null)).toBe("external");
  });
});

describe("sourceFromStack", () => {
  it("reads the route from a production stack", () => {
    const stack = "Error\n    at logOutboundEmail (/var/task/.next/server/chunks/123.js:1:2)\n    at async POST (/var/task/.next/server/app/api/admin/ir/projects/[id]/report/route.js:1:900)";
    expect(sourceFromStack(stack)).toBe("api/admin/ir/projects/[id]/report");
  });
  it("marks pages and drops route groups", () => {
    expect(sourceFromStack("at x (/app/src/app/(admin)/admin/marketplace/page.tsx:3:1)")).toBe("admin/marketplace (page)");
  });
  it("is null without an app frame", () => {
    expect(sourceFromStack("at x (/var/task/node_modules/a.js:1:1)")).toBeNull();
    expect(sourceFromStack(undefined)).toBeNull();
  });
});

describe("userIdFromAuthCookies", () => {
  const jwt = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.s`;
  const id = "33333333-3333-3333-3333-333333333333";
  it("reads a plain session cookie", () => {
    expect(userIdFromAuthCookies([{ name: "sb-abc-auth-token", value: JSON.stringify({ access_token: jwt(id) }) }])).toBe(id);
  });
  it("reads a chunked base64 cookie", () => {
    const raw = "base64-" + Buffer.from(JSON.stringify({ access_token: jwt(id) })).toString("base64");
    const half = Math.floor(raw.length / 2);
    expect(userIdFromAuthCookies([{ name: "sb-abc-auth-token.1", value: raw.slice(half) }, { name: "sb-abc-auth-token.0", value: raw.slice(0, half) }])).toBe(id);
  });
  it("is null when signed out or malformed", () => {
    expect(userIdFromAuthCookies([])).toBeNull();
    expect(userIdFromAuthCookies([{ name: "sb-abc-auth-token", value: "nope" }])).toBeNull();
  });
});

describe("logOutboundEmail", () => {
  it("writes one row per recipient with their role", async () => {
    await logOutboundEmail({ to: ["Maya@northstar.com", "Sam Park <sam@harbor.vc>", "someone@else.com"], subject: "Hi", html: "<p>x</p>", status: "sent", providerId: "re_1", source: "ir-report" });
    expect(inserted).toHaveLength(3);
    const byTo = Object.fromEntries((inserted as Array<{ to_email: string; recipient_role: string; recipient_user_id: string | null }>).map((r) => [r.to_email, r]));
    expect(byTo["Maya@northstar.com"].recipient_role).toBe("founder");
    expect(byTo["sam@harbor.vc"].recipient_role).toBe("investor");
    expect(byTo["someone@else.com"].recipient_role).toBe("external");
    expect(byTo["someone@else.com"].recipient_user_id).toBeNull();
  });

  it("uses the audience hint for people without an account", async () => {
    await logOutboundEmail({ to: "lp@fund.com", subject: "Intro", status: "sent", audience: "investor" });
    expect((inserted[0] as { recipient_role: string }).recipient_role).toBe("investor");
  });

  it("an account's real role wins over the hint", async () => {
    await logOutboundEmail({ to: "kthetsy@myicfos.com", subject: "Intro", status: "sent", audience: "investor" });
    expect((inserted[0] as { recipient_role: string }).recipient_role).toBe("staff");
  });

  it("records the scheduled job as the source", async () => {
    await runInJob({ job: "/api/cron/stage-gate-reminders", runId: 7 }, () => logOutboundEmail({ to: "maya@northstar.com", subject: "Reminder", status: "sent" }));
    expect(inserted[0]).toMatchObject({ source: "job:/api/cron/stage-gate-reminders", job: "/api/cron/stage-gate-reminders", run_id: 7 });
  });

  it("drops bodies for bulk marketing and skips when there is no recipient", async () => {
    await logOutboundEmail({ to: "maya@northstar.com", subject: "News", html: "<p>big</p>", status: "sent", storeBody: false });
    expect((inserted[0] as { body_html: string | null }).body_html).toBeNull();
    inserted.length = 0;
    await logOutboundEmail({ to: "", subject: "x", status: "sent" });
    expect(inserted).toHaveLength(0);
  });
});

describe("labels", () => {
  it("orders results by what matters most", () => {
    expect(emailResult({ status: "failed" }).text).toBe("Failed");
    expect(emailResult({ status: "sent", bouncedAt: "t", openedAt: "t" }).text).toBe("Bounced");
    expect(emailResult({ status: "sent", openedAt: "t", clickedAt: "t" }).text).toBe("Clicked");
    expect(emailResult({ status: "sent", deliveredAt: "t" }).text).toBe("Delivered");
    expect(emailResult({ status: "sent" }).text).toBe("Sent");
  });
  it("names sources in plain words", () => {
    expect(sourceLabel("ir-report-copy")).toBe("IR report copy (Email me)");
    expect(sourceLabel("job:/api/cron/stage-gate-reminders")).toBe("Scheduled · Stage gate reminders");
    expect(sourceLabel("api/admin/ir/projects/[id]/report")).toBe("Projects · Report");
    expect(sourceLabel("matching_intro_outcome")).toBe("Matching intro outcome");
  });
});
