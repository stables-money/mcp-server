import { describe, it, expect, vi } from "vitest";
import worker, { rateLimitKey, type Env } from "./worker.js";

const ORIGIN = "https://mcp.stables.money";
const TEST_KEY = "sti_test_abc123_secretsecretsecretsecret";

function env(success: boolean): Env & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    RATE_LIMITER: {
      limit: vi.fn(async ({ key }: { key: string }) => {
        calls.push(key);
        return { success };
      }),
    },
  };
}

describe("rateLimitKey", () => {
  it("keys on the API key when one is sent", () => {
    const req = new Request(ORIGIN, {
      headers: { authorization: `Bearer ${TEST_KEY}`, "cf-connecting-ip": "1.2.3.4" },
    });
    expect(rateLimitKey(req)).toBe(`key:${TEST_KEY}`);
  });
  it("falls back to the client IP without a key", () => {
    const req = new Request(ORIGIN, { headers: { "cf-connecting-ip": "1.2.3.4" } });
    expect(rateLimitKey(req)).toBe("ip:1.2.3.4");
  });
});

describe("worker fetch", () => {
  it("passes allowed requests to the handler", async () => {
    const e = env(true);
    const res = await worker.fetch(new Request(`${ORIGIN}/health`), e);
    expect(res.status).toBe(200);
    expect(e.calls).toEqual(["ip:unknown"]);
  });
  it("returns 429 with retry-after when the limiter rejects", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/health`), env(false));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toMatchObject({ error: "rate_limited" });
  });
});
