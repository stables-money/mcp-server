/**
 * Cloudflare Worker entry point for the hosted Stables MCP server.
 *
 * Deployed with `npm run deploy:worker` (see wrangler.toml). The Worker
 * holds no customer credentials: a request either carries the caller's own
 * API key, or an OAuth token whose grant carries the API key minted when
 * the user signed in (src/oauth). Its only secrets are the Auth0 client
 * secret and the gateway signing secret.
 *
 * Requests are rate limited before anything else runs, in two layers:
 *   1. Per client IP, always. Browser-facing sign-in pages (consent page and
 *      Auth0 return, which write to KV) get a tight limit; everything else a
 *      generous ceiling, since Claude.ai and ChatGPT call from a few shared
 *      addresses for all their users. This stops one host minting a fresh
 *      per-caller bucket with every made-up token.
 *   2. Per caller: by API key or OAuth token when one is sent, otherwise by
 *      client IP, so one caller cannot crowd out the rest.
 * These run inside the Worker, so rejected requests still count towards
 * usage; the zone rate-limit rule in front is what stops floods earlier.
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
  /** Per-IP ceiling for every request. Optional so local runs work without it. */
  IP_RATE_LIMITER?: RateLimiter;
  /** Tight per-IP limit for the browser-facing sign-in pages. */
  SIGNIN_RATE_LIMITER?: RateLimiter;
}

/** Pages a person's browser opens while signing in; each visit writes to KV. */
const SIGNIN_PATHS = new Set(["/authorize", "/callback"]);

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
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
  return `ip:${clientIp(request)}`;
}

/** The per-IP limiter for this request, before any per-caller limit. */
export function ipLimiterFor(request: Request, env: Env): RateLimiter | undefined {
  const path = new URL(request.url).pathname;
  return SIGNIN_PATHS.has(path) ? env.SIGNIN_RATE_LIMITER : env.IP_RATE_LIMITER;
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
    const ipLimiter = ipLimiterFor(request, env);
    if (ipLimiter) {
      const byIp = await ipLimiter.limit({ key: `ip:${clientIp(request)}` });
      if (!byIp.success) return rateLimited();
    }
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
