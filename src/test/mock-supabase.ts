import { vi } from "vitest";

type SingleResult = { data: unknown; error: unknown };

type MockQueryChain = {
  select: ReturnType<typeof vi.fn<() => MockQueryChain>>;
  eq: ReturnType<typeof vi.fn<() => MockQueryChain>>;
  insert: ReturnType<typeof vi.fn<() => MockQueryChain>>;
  update: ReturnType<typeof vi.fn<() => MockQueryChain>>;
  single: ReturnType<typeof vi.fn<() => Promise<SingleResult>>>;
};

export function createMockSupabaseClient(options: {
  getUser?: { data: { user: { id: string } | null }; error: unknown };
  profile?: SingleResult;
  tables?: Record<string, Partial<Record<string, () => unknown>>>;
}) {
  const from = vi.fn((table: string) => {
    const tableHandlers = options.tables?.[table] ?? {};

    const chain: MockQueryChain = {
      select: vi.fn((): MockQueryChain => chain),
      eq: vi.fn((): MockQueryChain => chain),
      insert: vi.fn((): MockQueryChain => chain),
      update: vi.fn((): MockQueryChain => chain),
      single: vi.fn(async (): Promise<SingleResult> => {
        if (tableHandlers.single) {
          return tableHandlers.single() as SingleResult;
        }
        if (table === "profiles") {
          return options.profile ?? { data: null, error: { message: "missing" } };
        }
        return { data: null, error: null };
      }),
    };

    if (tableHandlers.select) {
      chain.select = vi.fn((): MockQueryChain => (tableHandlers.select?.() as MockQueryChain | undefined) ?? chain);
    }
    if (tableHandlers.insert) {
      chain.insert = vi.fn((): MockQueryChain => (tableHandlers.insert?.() as MockQueryChain | undefined) ?? chain);
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
