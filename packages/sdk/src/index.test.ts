import { describe, expect, it, vi } from "vitest";
import { Memora, MemoraError } from "./index";

function stubFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status,
      headers: { "Content-Type": "application/json", ...(next.headers ?? {}) },
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const client = (fetch: typeof globalThis.fetch, maxRetries = 0) =>
  new Memora({ apiKey: "sk_test_x", baseUrl: "https://example.test", fetch, maxRetries });

describe("remember", () => {
  it("maps camelCase params onto the API's snake_case body", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { outcomes: [] } }]);
    await client(fetch).remember({
      userId: "user_1",
      content: "I prefer dark mode",
      agentId: "support-bot",
      sessionId: "conv_2",
    });

    expect(calls[0].url).toBe("https://example.test/api/v1/memories/remember");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      user_id: "user_1",
      content: "I prefer dark mode",
      agent_id: "support-bot",
      session_id: "conv_2",
    });
  });

  it("omits unset optional fields rather than sending nulls", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { outcomes: [] } }]);
    await client(fetch).remember({ userId: "u", content: "c" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ user_id: "u", content: "c" });
  });

  it("sends the key as a bearer token", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { outcomes: [] } }]);
    await client(fetch).remember({ userId: "u", content: "c" });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk_test_x");
  });
});

describe("recall", () => {
  it("serialises Date filters as ISO strings", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { results: [] } }]);
    await client(fetch).recall({
      userId: "u",
      query: "dietary restrictions",
      topK: 5,
      types: ["preference"],
      since: new Date("2026-01-01T00:00:00Z"),
    });

    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      user_id: "u",
      query: "dietary restrictions",
      top_k: 5,
      type: ["preference"],
      since: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("list", () => {
  it("builds a query string and skips unset filters", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { memories: [], total: 0 } }]);
    await client(fetch).list({ userId: "u", limit: 10 });
    expect(calls[0].url).toBe("https://example.test/api/v1/memories?user_id=u&limit=10");
  });
});

describe("errors", () => {
  it("throws MemoraError carrying the API's message", async () => {
    const { fetch } = stubFetch([{ status: 400, body: { error: "user_id is required" } }]);
    await expect(client(fetch).remember({ userId: "u", content: "c" })).rejects.toThrow(
      "user_id is required"
    );
  });

  it("flags auth failures", async () => {
    const { fetch } = stubFetch([{ status: 401, body: { error: "Invalid or missing API key" } }]);
    const error = await client(fetch)
      .recall({ userId: "u", query: "q" })
      .catch((e: unknown) => e as MemoraError);
    expect(error).toBeInstanceOf(MemoraError);
    expect((error as MemoraError).isAuthError).toBe(true);
  });

  it("does not retry a 400", async () => {
    const { fetch, calls } = stubFetch([{ status: 400, body: { error: "bad" } }]);
    await expect(client(fetch, 2).remember({ userId: "u", content: "c" })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("retries a 429 and returns the eventual success", async () => {
    const { fetch, calls } = stubFetch([
      { status: 429, body: { error: "slow down" } },
      { status: 200, body: { outcomes: [{ decision: "ADD" }] } },
    ]);
    const result = await client(fetch, 2).remember({ userId: "u", content: "c" });
    expect(calls).toHaveLength(2);
    expect(result.outcomes).toHaveLength(1);
  });
});

describe("profile", () => {
  it("passes the profile through when one exists", async () => {
    const { fetch } = stubFetch([
      { status: 200, body: { results: [], profile: { content: "Vegan, allergic to peanuts.", generatedAt: "2026-08-21T00:00:00Z", memoryCount: 42 } } },
    ]);
    const { profile } = await client(fetch).recall({ userId: "u", query: "q" });
    expect(profile?.content).toBe("Vegan, allergic to peanuts.");
    expect(profile?.memoryCount).toBe(42);
  });

  it("is null for a user nothing has been consolidated for yet", async () => {
    const { fetch } = stubFetch([{ status: 200, body: { results: [], profile: null } }]);
    const { profile } = await client(fetch).recall({ userId: "u", query: "q" });
    expect(profile).toBeNull();
  });
});

describe("guards", () => {
  it("sends an idempotency key when one is given", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { outcomes: [] } }]);
    await client(fetch).remember({ userId: "u", content: "c", idempotencyKey: "abc-123" });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("abc-123");
  });

  it("omits the header when no key is given", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: { outcomes: [] } }]);
    await client(fetch).remember({ userId: "u", content: "c" });
    expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
  });

  it("does not retry a quota failure — waiting cannot fix it", async () => {
    const { fetch, calls } = stubFetch([{ status: 402, body: { error: "quota exhausted" } }]);
    const error = await client(fetch, 2)
      .remember({ userId: "u", content: "c" })
      .catch((e: unknown) => e as MemoraError);
    expect(calls).toHaveLength(1);
    expect((error as MemoraError).isQuotaExceeded).toBe(true);
  });

  it("flags a rate limit and carries the server's retry delay", async () => {
    const { fetch } = stubFetch([{ status: 429, body: { error: "slow down" }, headers: { "Retry-After": "7" } }]);
    const error = await client(fetch, 0)
      .recall({ userId: "u", query: "q" })
      .catch((e: unknown) => e as MemoraError);
    expect((error as MemoraError).isRateLimited).toBe(true);
    expect((error as MemoraError).retryAfterSeconds).toBe(7);
  });

  it("treats a missing scope as an auth failure, not a retryable one", async () => {
    const { fetch, calls } = stubFetch([{ status: 403, body: { error: "no write scope" } }]);
    const error = await client(fetch, 2)
      .remember({ userId: "u", content: "c" })
      .catch((e: unknown) => e as MemoraError);
    expect(calls).toHaveLength(1);
    expect((error as MemoraError).isAuthError).toBe(true);
  });
});

describe("construction", () => {
  it("requires an api key", () => {
    expect(() => new Memora({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("tolerates a trailing slash on the base url", async () => {
    const { fetch, calls } = stubFetch([{ status: 200, body: {} }]);
    const c = new Memora({ apiKey: "k", baseUrl: "https://example.test/", fetch });
    await c.experiences.recommend("deploy");
    expect(calls[0].url).toBe("https://example.test/api/v1/experiences/recommend");
  });
});
