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

describe("per-IP limits before the per-caller one", () => {
  function limiter(allow: (key: string) => boolean) {
    const keys: string[] = [];
    return {
      keys,
      limit: vi.fn(async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: allow(key) };
      }),
    };
  }

  it("made-up tokens from one host share the host's IP bucket", async () => {
    const ip = limiter(() => false);
    const caller = limiter(() => true);
    const e: Env = { RATE_LIMITER: caller, IP_RATE_LIMITER: ip, SIGNIN_RATE_LIMITER: limiter(() => true) };
    for (const token of ["fake-1", "fake-2"]) {
      const res = await worker.fetch(
        new Request(`${ORIGIN}/mcp`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "cf-connecting-ip": "9.9.9.9" },
        }),
        e
      );
      expect(res.status).toBe(429);
    }
    expect(ip.keys).toEqual(["ip:9.9.9.9", "ip:9.9.9.9"]);
    expect(caller.keys).toEqual([]);
  });

  it("the sign-in pages use the tight sign-in limiter, other paths the IP ceiling", async () => {
    const ip = limiter(() => true);
    const signin = limiter(() => false);
    const e: Env = { RATE_LIMITER: limiter(() => true), IP_RATE_LIMITER: ip, SIGNIN_RATE_LIMITER: signin };
    const headers = { "cf-connecting-ip": "5.6.7.8" };
    expect((await worker.fetch(new Request(`${ORIGIN}/authorize?x=1`, { headers }), e)).status).toBe(429);
    expect((await worker.fetch(new Request(`${ORIGIN}/callback`, { headers }), e)).status).toBe(429);
    expect((await worker.fetch(new Request(`${ORIGIN}/health`, { headers }), e)).status).toBe(200);
    expect(signin.keys).toEqual(["ip:5.6.7.8", "ip:5.6.7.8"]);
    expect(ip.keys).toEqual(["ip:5.6.7.8"]);
  });

  it("still runs with only the per-caller limiter bound", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/health`), env(true));
    expect(res.status).toBe(200);
  });
});
