/**
 * Shared shapes for the hosted server's OAuth support.
 *
 * The Worker is the OAuth authorization server MCP clients talk to (Claude,
 * ChatGPT, Cursor, ...). Behind it, Auth0 signs the user in exactly as the
 * dashboard does, and the Worker then mints a Stables API key for the
 * organisation the user picked. That key lives in the grant's encrypted
 * props, so every later MCP request is served with it and the Auth0 token
 * is never kept.
 */

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/**
 * Scopes. `stables:read` is what any connection gets; `stables:write` lets the
 * agent change things and move money, and is granted only when the person
 * ticks "make changes" on the consent page. Grants made before these scopes
 * existed carry `stables`, which keeps meaning read and write.
 */
export const READ_SCOPE = "stables:read";
export const WRITE_SCOPE = "stables:write";
export const LEGACY_SCOPE = "stables";
/** The baseline a client should request first (RFC 9728 scopes_supported). */
export const SCOPE = READ_SCOPE;
export const SUPPORTED_SCOPES = [READ_SCOPE, WRITE_SCOPE, "offline_access", LEGACY_SCOPE];

export type StablesEnvironment = "sandbox" | "production";

/** What a grant carries; handlers read it as ctx.props. */
/**
 * How long a connection lasts before the person signs in again: the refresh
 * token's lifetime, and the expiry of the API key minted for it.
 */
export const CONNECTION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface GrantProps {
  apiKey: string;
  /** "api_key" when the caller presented its own key: full access, as before. */
  source?: "oauth" | "api_key";
  environment: StablesEnvironment;
  apiKeyId?: string;
  email?: string;
  orgId?: string;
  clientName?: string;
}

/** Bindings and settings the OAuth path needs. See wrangler.toml. */
export interface OAuthEnv {
  /** KV namespace the provider stores clients, grants and tokens in. */
  OAUTH_KV?: unknown;
  /** Injected by the provider for the default handler. */
  OAUTH_PROVIDER?: OAuthHelpers;
  /** Canonical public origin; defaults to the request origin. */
  MCP_PUBLIC_URL?: string;
  /** Auth0 custom domain, e.g. login.stables.money. */
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  /** Worker secret. */
  AUTH0_CLIENT_SECRET?: string;
  /**
   * "enforce" refuses a sign-in whose ID token reports no second factor;
   * anything else only logs it, so the check can be watched before it bites.
   */
  MCP_REQUIRE_MFA?: string;
  /** Worker secret shared with api-lambda-authoriser; unset = unsigned. */
  MCP_GATEWAY_SIGNING_SECRET?: string;
}
