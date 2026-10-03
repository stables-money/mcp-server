/**
 * Per-request authentication for the hosted server.
 *
 * The hosted service holds no credentials of its own. Each request carries the
 * caller's Stables API key, and the key alone decides which environment the
 * request reaches: `sti_test_…` goes to sandbox, `sti_live_…` to production.
 * That is the same rule the stdio server applies to STABLES_API_KEY, so a key
 * issued during onboarding works here with no further setup.
 */

import { StablesApiClient, apiUrlForKey } from "../lib/stables-client.js";

export const BEARER_CHALLENGE =
  'Bearer realm="stables", error="invalid_token", ' +
  'error_description="Send your Stables API key as a bearer token: Authorization: Bearer sti_test_... (sandbox) or sti_live_... (production)"';

export type AuthResult = { ok: true; client: StablesApiClient } | { ok: false; reason: string };

/**
 * Read the API key off a request. The Authorization header is the standard
 * place; X-Api-Key is accepted because the Stables API itself accepts it and
 * some MCP clients only let users set that header.
 */
export function extractApiKey(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const apiKeyHeader = headers.get("x-api-key");
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

export function authenticate(headers: Headers): AuthResult {
  const apiKey = extractApiKey(headers);
  if (!apiKey) {
    return { ok: false, reason: "Missing API key" };
  }
  const baseUrl = apiUrlForKey(apiKey);
  if (!baseUrl) {
    // A `sti_local_…` key or an unrecognised shape has no environment we can
    // route to. The stdio server lets STABLES_API_URL resolve that; the hosted
    // one has no such channel, and guessing production would be wrong.
    return {
      ok: false,
      reason:
        "Unrecognised API key. The hosted server accepts sti_test_… (sandbox) and sti_live_… (production) keys; for a local deployment run the server locally with STABLES_API_URL",
    };
  }
  return { ok: true, client: new StablesApiClient(apiKey, baseUrl) };
}
