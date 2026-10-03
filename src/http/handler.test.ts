import { describe, it, expect, vi, afterEach } from "vitest";
import { handleRequest } from "./handler.js";
import { authenticate, extractApiKey } from "./auth.js";

const ORIGIN = "https://mcp.stables.money";
const TEST_KEY = "sti_test_abc123_secretsecretsecretsecret";
const LIVE_KEY = "sti_live_abc123_secretsecretsecretsecret";

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-06-18",
};

function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function post(body: string, headers: Record<string, string> = {}) {
  return handleRequest(
    new Request(`${ORIGIN}/mcp`, { method: "POST", headers: { ...MCP_HEADERS, ...headers }, body })
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractApiKey", () => {
  it("reads a bearer token", () => {
    expect(extractApiKey(new Headers({ authorization: `Bearer ${TEST_KEY}` }))).toBe(TEST_KEY);
  });
  it("is case-insensitive on the scheme and trims", () => {
    expect(extractApiKey(new Headers({ authorization: `bearer  ${TEST_KEY} ` }))).toBe(TEST_KEY);
  });
  it("falls back to X-Api-Key", () => {
    expect(extractApiKey(new Headers({ "x-api-key": TEST_KEY }))).toBe(TEST_KEY);
  });
  it("ignores a non-bearer Authorization header", () => {
    expect(extractApiKey(new Headers({ authorization: "Basic abc" }))).toBeNull();
  });
});

describe("authenticate", () => {
  it("routes a test key to sandbox and a live key to production", () => {
    const sandbox = authenticate(new Headers({ authorization: `Bearer ${TEST_KEY}` }));
    const prod = authenticate(new Headers({ authorization: `Bearer ${LIVE_KEY}` }));
    expect(sandbox.ok && prod.ok).toBe(true);
  });
  it("rejects a local or malformed key rather than guessing an environment", () => {
    expect(authenticate(new Headers({ authorization: "Bearer sti_local_abc_def" })).ok).toBe(false);
    expect(authenticate(new Headers({ authorization: "Bearer nope" })).ok).toBe(false);
  });
});

describe("handleRequest", () => {
  it("describes itself at the root without authentication", async () => {
    const res = await handleRequest(new Request(`${ORIGIN}/`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endpoint).toBe(`${ORIGIN}/mcp`);
    expect(body.transport).toBe("streamable-http");
  });

  it("answers health checks", async () => {
    const res = await handleRequest(new Request(`${ORIGIN}/health`));
    expect(res.status).toBe(200);
  });

  it("answers CORS preflight", async () => {
    const res = await handleRequest(new Request(`${ORIGIN}/mcp`, { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("returns 401 with a bearer challenge when no key is sent", async () => {
    const res = await post(rpc("initialize"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer /);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for a key whose environment cannot be inferred", async () => {
    const res = await post(rpc("initialize"), { authorization: "Bearer sti_local_abc_def" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/sti_test_/);
  });

  it("never forwards a request to the API before authentication succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await post(rpc("tools/call", { name: "list_customers", arguments: {} }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("initialises and lists the full tool set for an authenticated caller", async () => {
    const init = await post(
      rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      }),
      { authorization: `Bearer ${TEST_KEY}` }
    );
    expect(init.status).toBe(200);
    const initBody = await init.json();
    expect(initBody.result.serverInfo.name).toBe("stables-mcp-server");

    // Stateless: the next request needs no session id.
    const list = await post(rpc("tools/list", {}, 2), { authorization: `Bearer ${TEST_KEY}` });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    const names = listBody.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("create_quote");
    expect(names).toContain("list_customers");
    expect(names.length).toBeGreaterThanOrEqual(26);
  });

  it("calls the Stables API with the caller's key, at the environment the key implies", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ customers: [], has_more: false }), {
        headers: { "content-type": "application/json" },
      })
    );
    const res = await post(rpc("tools/call", { name: "list_customers", arguments: {} }, 3), {
      authorization: `Bearer ${TEST_KEY}`,
    });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.sandbox.stables.money/api/v1/customers");
    expect((opts?.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TEST_KEY}`);
  });

  it("sends a live key to production", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ customers: [], has_more: false }), {
        headers: { "content-type": "application/json" },
      })
    );
    await post(rpc("tools/call", { name: "list_customers", arguments: {} }, 4), {
      authorization: `Bearer ${LIVE_KEY}`,
    });
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://api.stables.money/api/v1/customers");
  });

  it("404s on unknown paths and points at the endpoint", async () => {
    const res = await handleRequest(new Request(`${ORIGIN}/sse`));
    expect(res.status).toBe(404);
    expect((await res.json()).message).toContain("/mcp");
  });
});
