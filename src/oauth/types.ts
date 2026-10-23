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

/** The one scope the server grants; tool-level scopes can come later. */
export const SCOPE = "stables";
export const SUPPORTED_SCOPES = [SCOPE, "offline_access"];

export type StablesEnvironment = "sandbox" | "production";

/** What a grant carries; handlers read it as ctx.props. */
export interface GrantProps {
  apiKey: string;
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
  /** Worker secret shared with api-lambda-authoriser; unset = unsigned. */
  MCP_GATEWAY_SIGNING_SECRET?: string;
}
