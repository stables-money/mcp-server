/**
 * Web-standard HTTP handler for the hosted Stables MCP server.
 *
 * Works anywhere a `fetch`-style `Request` → `Response` function runs: a
 * Cloudflare Worker, a Node process (see serve.ts), or any other runtime with
 * the web platform APIs. The server is stateless: each request authenticates
 * from its own headers and gets a fresh MCP server bound to that key, so
 * nothing about one caller survives to the next and no session store is
 * needed.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  SERVER_NAME,
  SERVER_VERSION,
  createStablesMcpServer,
  type ServerOptions,
} from "../server.js";
import { BEARER_CHALLENGE, authenticate } from "./auth.js";
import type { StablesApiClient } from "../lib/stables-client.js";

export const MCP_PATH = "/mcp";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-api-key, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function unauthorized(reason: string): Response {
  return json(
    {
      error: "unauthorized",
      message: reason,
      hint: "Authorization: Bearer <your Stables API key>. A sti_test_ key reaches sandbox, a sti_live_ key reaches production and moves real money.",
      docs: "https://docs.stables.money/get-started/getting-started/quickstart/building-with-ai",
    },
    401,
    { "www-authenticate": BEARER_CHALLENGE }
  );
}

function describe(origin: string): Response {
  return json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description:
      "Hosted MCP server for the Stables fiat-to-crypto API. Connect any MCP client to the endpoint below with your Stables API key as a bearer token.",
    endpoint: `${origin}${MCP_PATH}`,
    transport: "streamable-http",
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer <api key>",
      environments: {
        "sti_test_…": "sandbox (https://api.sandbox.stables.money)",
        "sti_live_…": "production (https://api.stables.money)",
      },
    },
    docs: "https://docs.stables.money/get-started/getting-started/quickstart/building-with-ai",
    source: "https://github.com/stables-money/mcp-server",
  });
}

/**
 * Serve one MCP request for an already-authenticated caller. Shared by the
 * bearer-key path below and the OAuth path in the Worker, which resolves the
 * caller's API key from the grant before calling this.
 */
export async function serveMcp(
  request: Request,
  client: StablesApiClient,
  options: ServerOptions = {}
): Promise<Response> {
  // Stateless means no server-initiated SSE stream. Answering GET with 405
  // is how the spec says to decline it; letting the transport open a stream
  // that closes at once makes clients reconnect in a tight loop.
  if (request.method === "GET") {
    return json(
      {
        error: "method_not_allowed",
        message: "This server has no SSE stream. Send JSON-RPC with POST.",
      },
      405,
      { allow: "POST, OPTIONS" }
    );
  }

  const server = createStablesMcpServer(client, options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session ids, so any instance (or any edge location) can
    // answer any request, and a client never has to re-initialise after a
    // deploy. Each tool call is one round trip to the Stables API anyway.
    sessionIdGenerator: undefined,
    // Plain JSON bodies rather than SSE frames: nothing here streams partial
    // results, and JSON is the easier contract for clients and for debugging.
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (url.pathname === "/" || url.pathname === "") {
    return withCors(describe(url.origin));
  }
  if (url.pathname === "/health") {
    return withCors(json({ status: "ok", version: SERVER_VERSION }));
  }
  if (url.pathname === MCP_PATH || url.pathname === `${MCP_PATH}/`) {
    // Stateless means no server-initiated SSE stream. Answering GET with 405
    // is how the spec says to decline it; letting the transport open a stream
    // that closes at once makes clients reconnect in a tight loop.
    if (request.method === "GET") {
      return withCors(
        json(
          {
            error: "method_not_allowed",
            message: "This server has no SSE stream. Send JSON-RPC with POST.",
          },
          405,
          { allow: "POST, OPTIONS" }
        )
      );
    }
    const auth = authenticate(request.headers);
    if (!auth.ok) return withCors(unauthorized(auth.reason));
    return withCors(await serveMcp(request, auth.client));
  }
  return withCors(
    json(
      {
        error: "not_found",
        message: `Nothing at ${url.pathname}. The MCP endpoint is ${MCP_PATH}.`,
      },
      404
    )
  );
}
