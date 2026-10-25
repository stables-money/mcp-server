import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker, { type Env, normaliseAuthorization } from "../worker.js";
import { grantScope } from "./handlers.js";
import { grantFor } from "./provider.js";
import { GATEWAY_SIGNATURE_HEADER, signGatewayRequest } from "../lib/stables-client.js";

const ORIGIN = "https://mcp.stables.money";
const RESOURCE = `${ORIGIN}/mcp`;
const TEST_KEY = "sti_test_abc123_secretsecretsecretsecret";
const MINTED_KEY = "sti_test_minted_keykeykeykeykeykey";
const AUTH0_DOMAIN = "login.stables.test";
const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  "mcp-protocol-version": "2025-06-18",
};

// ---- an in-memory KV namespace, enough for the provider ---------------------

interface Stored {
  value: string | ArrayBuffer;
  metadata?: unknown;
  expiration?: number;
}

function memoryKv() {
  const store = new Map<string, Stored>();
  const live = (key: string): Stored | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiration && entry.expiration * 1000 < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };
  const typed = (entry: Stored, options: unknown) => {
    const type = typeof options === "string" ? options : (options as { type?: string })?.type;
    if (type === "json") {
      return typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
    }
    if (type === "arrayBuffer") return entry.value;
    return entry.value;
  };
  return {
    store,
    async get(key: string, options?: unknown) {
      const entry = live(key);
      return entry ? typed(entry, options) : null;
    },
    async getWithMetadata(key: string, options?: unknown) {
      const entry = live(key);
      return entry
        ? { value: typed(entry, options), metadata: entry.metadata ?? null }
        : { value: null, metadata: null };
    },
    async put(
      key: string,
      value: string | ArrayBuffer,
      options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }
    ) {
      store.set(key, {
        value,
        metadata: options?.metadata,
        expiration: options?.expirationTtl
          ? Math.floor(Date.now() / 1000) + options.expirationTtl
          : options?.expiration,
      });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(options?: { prefix?: string }) {
      const keys = [...store.keys()]
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .filter((k) => live(k))
        .map((name) => ({
          name,
          metadata: store.get(name)?.metadata,
          expiration: store.get(name)?.expiration,
        }));
      return { keys, list_complete: true, cursor: undefined, cacheStatus: null };
    },
  };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    OAUTH_KV: memoryKv(),
    MCP_PUBLIC_URL: ORIGIN,
    AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: "auth0-client-id",
    AUTH0_CLIENT_SECRET: "auth0-client-secret",
    ...overrides,
  };
}

const ctx = { waitUntil() {}, passThroughOnException() {} };

function call(env: Env, path: string, init?: RequestInit) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), env, ctx);
}

function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function mcp(env: Env, body: string, headers: Record<string, string> = {}) {
  return call(env, "/mcp", { method: "POST", headers: { ...MCP_HEADERS, ...headers }, body });
}

function cookiesFrom(res: Response): string {
  const raw: string[] =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  return raw
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
}

function form(fields: Record<string, string>, cookie: string): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams(fields).toString(),
  };
}

function unsignedJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url").replace(/=+$/, "");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(payload)}.signature`;
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url").replace(/=+$/, "");
}

const customersResponse = () =>
  new Response(JSON.stringify({ customers: [], has_more: false }), {
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normaliseAuthorization", () => {
  it("maps X-Api-Key onto a bearer Authorization header", () => {
    const req = normaliseAuthorization(new Request(ORIGIN, { headers: { "x-api-key": TEST_KEY } }));
    expect(req.headers.get("authorization")).toBe(`Bearer ${TEST_KEY}`);
  });
  it("leaves an existing Authorization header alone", () => {
    const req = normaliseAuthorization(
      new Request(ORIGIN, { headers: { authorization: "Bearer other", "x-api-key": TEST_KEY } })
    );
    expect(req.headers.get("authorization")).toBe("Bearer other");
  });
});

describe("grantScope", () => {
  it("always grants read, write only when chosen, and keeps offline_access", () => {
    expect(grantScope(["offline_access", "admin"], false)).toEqual([
      "stables:read",
      "offline_access",
    ]);
    expect(grantScope([], true)).toEqual(["stables:read", "stables:write"]);
  });
});

describe("grantFor", () => {
  it("maps scopes to tool access; API keys keep everything; OAuth never gets admin", () => {
    expect(grantFor({ apiKey: "k", environment: "sandbox", source: "api_key" }, [])).toEqual({
      read: true,
      write: true,
      admin: true,
    });
    const oauth = { apiKey: "k", environment: "sandbox" as const, source: "oauth" as const };
    expect(grantFor(oauth, ["stables:read"])).toEqual({ read: true, write: false, admin: false });
    expect(grantFor(oauth, ["stables:read", "stables:write"])).toEqual({
      read: true,
      write: true,
      admin: false,
    });
    // Grants made before the split carry the legacy scope: read and write.
    expect(grantFor(oauth, ["stables"])).toEqual({ read: true, write: true, admin: false });
  });
});

describe("discovery", () => {
  it("publishes protected resource metadata pointing at this origin", async () => {
    const res = await call(makeEnv(), "/.well-known/oauth-protected-resource/mcp");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toBe(RESOURCE);
    expect(body.authorization_servers).toEqual([ORIGIN]);
    // Only the baseline: clients ask for read first and step up to write.
    expect(body.scopes_supported).toEqual(["stables:read"]);
  });

  it("publishes authorization server metadata with PKCE and registration", async () => {
    const res = await call(makeEnv(), "/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issuer).toBe(ORIGIN);
    expect(body.authorization_endpoint).toBe(`${ORIGIN}/authorize`);
    expect(body.token_endpoint).toBe(`${ORIGIN}/oauth/token`);
    expect(body.registration_endpoint).toBe(`${ORIGIN}/oauth/register`);
    expect(body.code_challenge_methods_supported).toContain("S256");
  });

  it("challenges an unauthenticated MCP request with the resource metadata URL", async () => {
    const res = await mcp(makeEnv(), rpc("initialize"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`
    );
  });

  it("still describes itself and answers health checks", async () => {
    expect((await call(makeEnv(), "/health")).status).toBe(200);
    const root = await call(makeEnv(), "/");
    expect(root.status).toBe(200);
  });
});

describe("API keys as bearer tokens", () => {
  it("serves a tool call with the caller's key, signed for the gateway", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(customersResponse());
    const env = makeEnv({ MCP_GATEWAY_SIGNING_SECRET: "gateway-secret" });
    const res = await mcp(env, rpc("tools/call", { name: "list_customers", arguments: {} }), {
      authorization: `Bearer ${TEST_KEY}`,
    });
    expect(res.status).toBe(200);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.sandbox.stables.money/api/v1/customers");
    const headers = opts?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(headers["User-Agent"]).toMatch(/^stables-mcp-server\//);
    const signature = headers[GATEWAY_SIGNATURE_HEADER];
    const t = Number(signature.match(/^t=(\d+),v1=/)?.[1]);
    expect(signature).toBe(
      await signGatewayRequest("gateway-secret", "GET", "/api/v1/customers", t)
    );
  });

  it("accepts the key as X-Api-Key too", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(customersResponse());
    const res = await mcp(makeEnv(), rpc("tools/call", { name: "list_customers", arguments: {} }), {
      "x-api-key": TEST_KEY,
    });
    expect(res.status).toBe(200);
  });

  it("sends no signature when no gateway secret is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(customersResponse());
    await mcp(makeEnv(), rpc("tools/call", { name: "list_customers", arguments: {} }), {
      authorization: `Bearer ${TEST_KEY}`,
    });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers[GATEWAY_SIGNATURE_HEADER]).toBeUndefined();
  });

  it("rejects a key whose environment cannot be inferred", async () => {
    const res = await mcp(makeEnv(), rpc("initialize"), { authorization: "Bearer sti_local_a_b" });
    expect(res.status).toBe(401);
  });
});

describe("OAuth flow end to end", () => {
  let env: Env;
  let upstream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    env = makeEnv();
    let minted = 0;
    upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (
        init?.method === "DELETE" &&
        url.startsWith("https://api.sandbox.stables.money/dashboard/v1/api-keys/")
      ) {
        return new Response(null, { status: 204 });
      }
      if (url === `https://${AUTH0_DOMAIN}/oauth/token`) {
        return Response.json({
          access_token: "auth0-access-token",
          id_token: unsignedJwt({
            sub: "auth0|user-1",
            email: "Bernardo@stables.money",
            name: "Bernardo",
            org_id: "org_sandbox1",
          }),
        });
      }
      if (url === "https://api.sandbox.stables.money/dashboard/v1/api-keys") {
        minted += 1;
        return Response.json({
          apiKey: { apiKeyId: `key-${minted}`, prefix: "minted" },
          plaintextKey: MINTED_KEY,
        });
      }
      if (url === "https://api.sandbox.stables.money/api/v1/customers") {
        return customersResponse();
      }
      if (url === "https://api.sandbox.stables.money/api/v1/customer") {
        return Response.json({
          customer_id: "cus-1",
          customer_type: "individual",
          status: "in_progress",
          first_name: "A",
          last_name: "B",
        });
      }
      throw new Error(`unexpected upstream fetch ${init?.method ?? "GET"} ${url}`);
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(upstream as unknown as typeof fetch);
  });

  async function registerClient(clientName = "Claude"): Promise<string> {
    const res = await call(env, "/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: clientName,
        redirect_uris: [CLAUDE_REDIRECT],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(res.status).toBe(201);
    return (await res.json()).client_id as string;
  }

  function authorizeUrl(clientId: string, challenge: string, scope = "stables:read"): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: CLAUDE_REDIRECT,
      scope,
      state: "client-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: RESOURCE,
    });
    return `/authorize?${params}`;
  }

  it("signs the user in through Auth0, mints a key, and serves tool calls with it", async () => {
    const clientId = await registerClient();
    const verifier = "client-pkce-verifier-client-pkce-verifier-0123456789";

    // 1. Consent page, bound to this browser by a cookie.
    const page = await call(env, authorizeUrl(clientId, await s256(verifier)));
    expect(page.status).toBe(200);
    const pageHtml = await page.text();
    expect(pageHtml).toContain("Connect Claude to Stables?");
    expect(pageHtml).toContain("claude.ai");
    const handle = pageHtml.match(/name="handle" value="([^"]+)"/)?.[1];
    expect(handle).toBeTruthy();
    const consentCookie = cookiesFrom(page);
    expect(consentCookie).toContain("__Host-");

    // 2. Allow for sandbox: off to Auth0 with the sandbox dashboard audience.
    const approved = await call(
      env,
      "/authorize",
      form({ handle: handle!, decision: "approve", environment: "sandbox" }, consentCookie)
    );
    expect(approved.status).toBe(302);
    const auth0Url = new URL(approved.headers.get("location")!);
    expect(auth0Url.origin).toBe(`https://${AUTH0_DOMAIN}`);
    expect(auth0Url.pathname).toBe("/authorize");
    expect(auth0Url.searchParams.get("client_id")).toBe("auth0-client-id");
    expect(auth0Url.searchParams.get("audience")).toBe(
      "https://api.sandbox.stables.money/dashboard"
    );
    expect(auth0Url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/callback`);
    expect(auth0Url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(auth0Url.searchParams.get("prompt")).toBe("login");
    const state = auth0Url.searchParams.get("state")!;
    const upstreamCookie = cookiesFrom(approved);
    expect(upstream).not.toHaveBeenCalled();

    // 3. Auth0 sends the user back: exchange the code, mint the key, finish.
    const back = await call(env, `/callback?code=auth0-code&state=${encodeURIComponent(state)}`, {
      headers: { cookie: upstreamCookie },
    });
    expect(back.status).toBe(302);
    const clientRedirect = new URL(back.headers.get("location")!);
    expect(`${clientRedirect.origin}${clientRedirect.pathname}`).toBe(CLAUDE_REDIRECT);
    expect(clientRedirect.searchParams.get("state")).toBe("client-state");
    const code = clientRedirect.searchParams.get("code")!;
    expect(code).toBeTruthy();

    const tokenCall = upstream.mock.calls.find(([u]) => String(u).endsWith("/oauth/token"))!;
    expect((tokenCall[1]?.headers as Record<string, string>)["user-agent"]).toMatch(
      /^stables-mcp-server\//
    );
    const tokenBody = new URLSearchParams(String(tokenCall[1]?.body));
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("code")).toBe("auth0-code");
    expect(tokenBody.get("client_secret")).toBe("auth0-client-secret");
    expect(tokenBody.get("code_verifier")).toBeTruthy();

    const mintCall = upstream.mock.calls.find(([u]) =>
      String(u).endsWith("/dashboard/v1/api-keys")
    )!;
    const mintHeaders = mintCall[1]?.headers as Record<string, string>;
    expect(mintHeaders.authorization).toBe("Bearer auth0-access-token");
    expect(mintHeaders["idempotency-key"]).toBeTruthy();
    const mintBody = JSON.parse(String(mintCall[1]?.body));
    expect(mintBody.name).toBe("Claude via MCP (bernardo@stables.money)");
    expect(mintBody.metadata).toMatchObject({ source: "mcp_oauth", client: "Claude" });

    // 4. The client trades the code for tokens.
    const token = await call(env, "/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: CLAUDE_REDIRECT,
        code_verifier: verifier,
        resource: RESOURCE,
      }).toString(),
    });
    expect(token.status).toBe(200);
    const tokens = await token.json();
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    // The consent page defaults to read only.
    expect(tokens.scope.split(" ")).toContain("stables:read");
    expect(tokens.scope.split(" ")).not.toContain("stables:write");

    // 5. Tool calls are served with the minted key, never the Auth0 token.
    const res = await mcp(env, rpc("tools/call", { name: "list_customers", arguments: {} }), {
      authorization: `Bearer ${tokens.access_token}`,
    });
    expect(res.status).toBe(200);
    const apiCall = upstream.mock.calls.find(([u]) => String(u).endsWith("/api/v1/customers"))!;
    expect((apiCall[1]?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${MINTED_KEY}`
    );

    // Nothing in KV holds the minted key in the clear.
    const kv = env.OAUTH_KV as ReturnType<typeof memoryKv>;
    for (const entry of kv.store.values()) {
      if (typeof entry.value === "string") expect(entry.value).not.toContain(MINTED_KEY);
    }
  });

  /** Runs consent → Auth0 → token exchange and returns the access token. */
  async function connect(
    options: { access?: "read" | "write"; scope?: string; clientName?: string } = {}
  ) {
    const clientId = await registerClient(options.clientName);
    const verifier = "v".repeat(43);
    const page = await call(env, authorizeUrl(clientId, await s256(verifier), options.scope));
    const pageHtml = await page.text();
    const handle = pageHtml.match(/name="handle" value="([^"]+)"/)![1];
    const fields: Record<string, string> = {
      handle,
      decision: "approve",
      environment: "sandbox",
    };
    if (options.access) fields.access = options.access;
    const approved = await call(env, "/authorize", form(fields, cookiesFrom(page)));
    const state = new URL(approved.headers.get("location")!).searchParams.get("state")!;
    const back = await call(env, `/callback?code=c&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookiesFrom(approved) },
    });
    const code = new URL(back.headers.get("location")!).searchParams.get("code")!;
    const token = await call(env, "/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: CLAUDE_REDIRECT,
        code_verifier: verifier,
        resource: RESOURCE,
      }).toString(),
    });
    const tokens = await token.json();
    return { pageHtml, accessToken: tokens.access_token as string, scope: tokens.scope as string };
  }

  const revokedKeys = () =>
    upstream.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")
      .map(([u]) => String(u).split("/").pop());

  it("reconnecting replaces the earlier connection: its key and grant are revoked", async () => {
    const first = await connect();
    const second = await connect();
    expect(revokedKeys()).toEqual(["key-1"]);

    const del = upstream.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE"
    )!;
    expect((del[1]?.headers as Record<string, string>).authorization).toBe(
      "Bearer auth0-access-token"
    );

    const listCustomers = rpc("tools/call", { name: "list_customers", arguments: {} });
    const stale = await mcp(env, listCustomers, { authorization: `Bearer ${first.accessToken}` });
    expect(stale.status).toBe(401);
    const fresh = await mcp(env, listCustomers, { authorization: `Bearer ${second.accessToken}` });
    expect(fresh.status).toBe(200);
  });

  it("connecting another client leaves the first client's connection alone", async () => {
    const claude = await connect();
    await connect({ clientName: "ChatGPT" });
    expect(revokedKeys()).toEqual([]);

    const res = await mcp(env, rpc("tools/call", { name: "list_customers", arguments: {} }), {
      authorization: `Bearer ${claude.accessToken}`,
    });
    expect(res.status).toBe(200);
  });

  const createCustomer = () =>
    rpc("tools/call", {
      name: "create_customer",
      arguments: { customerType: "individual", firstName: "A", lastName: "B" },
    });

  it("a read-only connection reads, is asked to step up for writes, and has no key tools", async () => {
    const { accessToken } = await connect();
    const auth = { authorization: `Bearer ${accessToken}` };

    const read = await mcp(env, rpc("tools/call", { name: "list_customers", arguments: {} }), auth);
    expect(read.status).toBe(200);

    const write = await mcp(env, createCustomer(), auth);
    expect(write.status).toBe(403);
    const challenge = write.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('scope="stables:read stables:write"');
    expect(challenge).toContain("resource_metadata=");
    // Never reached the API.
    const posts = upstream.mock.calls.filter(
      ([u, i]) => String(u).endsWith("/api/v1/customer") && i?.method === "POST"
    );
    expect(posts).toHaveLength(0);

    // A batch hiding a write behind a read is refused as a whole.
    const batch = `[${rpc("tools/call", { name: "list_customers", arguments: {} }, 7)},${createCustomer()}]`;
    expect((await mcp(env, batch, auth)).status).toBe(403);

    const list = await mcp(env, rpc("tools/list", {}, 2), auth);
    const names = (await list.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("create_transfer");
    expect(names).not.toContain("create_api_key");
    expect(names).not.toContain("revoke_api_key");
  });

  it("'Read and make changes' grants write, and the page preselects it when asked", async () => {
    const { pageHtml, accessToken, scope } = await connect({
      access: "write",
      scope: "stables:read stables:write",
    });
    expect(pageHtml).toContain("is asking for permission to make changes");
    expect(pageHtml).toMatch(/value="write" checked/);
    expect(scope.split(" ")).toContain("stables:write");

    const write = await mcp(env, createCustomer(), { authorization: `Bearer ${accessToken}` });
    expect(write.status).toBe(200);
    const posts = upstream.mock.calls.filter(
      ([u, i]) => String(u).endsWith("/api/v1/customer") && i?.method === "POST"
    );
    expect(posts).toHaveLength(1);
  });

  it("defaults to read only even when the client asks for write", async () => {
    const { scope } = await connect({ scope: "stables:read stables:write" });
    expect(scope.split(" ")).not.toContain("stables:write");
  });

  it("sends the client access_denied when the user cancels", async () => {
    const clientId = await registerClient();
    const page = await call(env, authorizeUrl(clientId, await s256("v".repeat(43))));
    const handle = (await page.text()).match(/name="handle" value="([^"]+)"/)![1];
    const denied = await call(
      env,
      "/authorize",
      form({ handle, decision: "deny", environment: "sandbox" }, cookiesFrom(page))
    );
    expect(denied.status).toBe(302);
    const location = new URL(denied.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe("client-state");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("shows an explanation when the organisation cannot create API keys", async () => {
    upstream.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/oauth/token")) {
        return Response.json({
          access_token: "t",
          id_token: unsignedJwt({ sub: "auth0|u", email: "x@y.z" }),
        });
      }
      return new Response("forbidden", { status: 403 });
    });
    const clientId = await registerClient();
    const page = await call(env, authorizeUrl(clientId, await s256("v".repeat(43))));
    const handle = (await page.text()).match(/name="handle" value="([^"]+)"/)![1];
    const approved = await call(
      env,
      "/authorize",
      form({ handle, decision: "approve", environment: "production" }, cookiesFrom(page))
    );
    const state = new URL(approved.headers.get("location")!).searchParams.get("state")!;
    const back = await call(env, `/callback?code=c&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookiesFrom(approved) },
    });
    expect(back.status).toBe(403);
    expect(await back.text()).toContain("create API keys");
  });

  it("refuses the consent page without an identity provider configured", async () => {
    const bare = makeEnv({ AUTH0_CLIENT_ID: "" });
    const clientId = await registerClient();
    const res = await call(bare, authorizeUrl(clientId, await s256("v".repeat(43))));
    expect(res.status).toBe(503);
  });
});
