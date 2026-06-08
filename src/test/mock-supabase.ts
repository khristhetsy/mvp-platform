import { vi } from "vitest";

type SingleResult = { data: unknown; error: unknown };

export function createMockSupabaseClient(options: {
  getUser?: { data: { user: { id: string } | null }; error: unknown };
  profile?: SingleResult;
  tables?: Record<string, Partial<Record<string, () => unknown>>>;
}) {
  const from = vi.fn((table: string) => {
    const tableHandlers = options.tables?.[table] ?? {};

    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      single: vi.fn(async () => {
        if (tableHandlers.single) {
          return tableHandlers.single();
        }
        if (table === "profiles") {
          return options.profile ?? { data: null, error: { message: "missing" } };
        }
        return { data: null, error: null };
      }),
    };

    if (tableHandlers.select) {
      chain.select = vi.fn(() => tableHandlers.select?.() ?? chain);
    }
    if (tableHandlers.insert) {
      chain.insert = vi.fn(() => tableHandlers.insert?.() ?? chain);
    }

    return chain;
  });

  return {
    auth: {
      getUser: vi.fn(async () => options.getUser ?? { data: { user: null }, error: { message: "no session" } }),
    },
    from,
  };
}

export async function readJsonResponse<T = Record<string, unknown>>(response: Response) {
  return (await response.json()) as T;
}
