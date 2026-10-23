/**
 * Cloudflare Worker entry point for the hosted Stables MCP server.
 *
 * Deployed with `npm run deploy:worker` (see wrangler.toml). The Worker
 * holds no customer credentials: a request either carries the caller's own
 * API key, or an OAuth token whose grant carries the API key minted when
 * the user signed in (src/oauth). Its only secrets are the Auth0 client
 * secret and the gateway signing secret.
 *
 * Requests are rate limited per caller before anything else runs: by API
 * key or OAuth token when one is sent, otherwise by client IP, so
 * unauthenticated probing from one IP cannot crowd out keyed callers.
 */

import { extractApiKey } from "./http/auth.js";
import { handleRequest } from "./http/handler.js";
import { providerFor } from "./oauth/provider.js";
import type { OAuthEnv } from "./oauth/types.js";

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env extends OAuthEnv {
  RATE_LIMITER: RateLimiter;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const noopContext: ExecutionContextLike = {
  waitUntil() {},
  passThroughOnException() {},
};

export function rateLimitKey(request: Request): string {
  const apiKey = extractApiKey(request.headers);
  if (apiKey) return `key:${apiKey}`;
  return `ip:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
}

function rateLimited(): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Retry after 60 seconds.",
    }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "60" },
    }
  );
}

/**
 * The OAuth host reads the Authorization header only. Clients that can set
 * just X-Api-Key (the Stables API accepts it too) are mapped onto it here.
 */
export function normaliseAuthorization(request: Request): Request {
  if (request.headers.get("authorization")) return request;
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey) return request;
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${apiKey}`);
  return new Request(request, { headers });
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response> {
    const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!success) return rateLimited();

    // Without the KV binding there is nowhere to keep grants, so the server
    // runs bearer-key only (local `wrangler dev --local`, unit tests).
    if (!env.OAUTH_KV) return handleRequest(request);

    const origin = (env.MCP_PUBLIC_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    const provider = providerFor(origin);
    return provider.fetch(
      normaliseAuthorization(request),
      env,
      (ctx ?? noopContext) as unknown as Parameters<typeof provider.fetch>[2]
    );
  },
};
