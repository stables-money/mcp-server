/**
 * Cloudflare Worker entry point for the hosted Stables MCP server.
 *
 * Deployed with `npm run deploy:worker` (see wrangler.toml). The Worker owns
 * no secrets: every request authenticates with the caller's own API key.
 *
 * Requests are rate limited per caller before the handler runs: by API key
 * when one is sent, otherwise by client IP, so unauthenticated probing from
 * one IP cannot crowd out keyed callers.
 */

import { extractApiKey } from "./http/auth.js";
import { handleRequest } from "./http/handler.js";

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  RATE_LIMITER: RateLimiter;
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { success } = await env.RATE_LIMITER.limit({ key: rateLimitKey(request) });
    if (!success) return rateLimited();
    return handleRequest(request);
  },
};
