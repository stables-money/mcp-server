/**
 * Auth0 as the identity step behind the hosted server's OAuth, and the
 * Stables API call that turns a signed-in user into an API key.
 *
 * Sandbox and production are separate Auth0 organisations with separate
 * dashboard API audiences, so the environment is chosen before the redirect
 * to Auth0 and decides which audience is requested and which API mints the
 * key. A token for the dashboard audience is what /dashboard/v1 routes
 * accept, so no api-service change is needed.
 */

import type { StablesEnvironment } from "./types.js";

export const API_BASE: Record<StablesEnvironment, string> = {
  sandbox: "https://api.sandbox.stables.money",
  production: "https://api.stables.money",
};

/** Auth0 API identifier the dashboard uses for this environment. */
export function dashboardAudience(environment: StablesEnvironment): string {
  return `${API_BASE[environment]}/dashboard`;
}

export function parseEnvironment(value: unknown): StablesEnvironment | null {
  return value === "sandbox" || value === "production" ? value : null;
}

export function environmentForKey(apiKey: string): StablesEnvironment {
  return apiKey.split("_")[1] === "live" ? "production" : "sandbox";
}

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
}

export function auth0ConfigFrom(env: {
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
}): Auth0Config | null {
  if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID || !env.AUTH0_CLIENT_SECRET) return null;
  return {
    domain: env.AUTH0_DOMAIN,
    clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET,
  };
}

/** A failure in one step of the sign-in, shown to the user on our own page. */
export class OAuthStepError extends Error {
  constructor(
    public readonly step: "auth0_token" | "identity" | "mint_key" | "callback",
    message: string,
    public readonly status?: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "OAuthStepError";
  }
}

// ---- PKCE towards Auth0 ----------------------------------------------------

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// ---- Auth0 endpoints -------------------------------------------------------

export function auth0AuthorizeUrl(
  config: Auth0Config,
  params: {
    redirectUri: string;
    environment: StablesEnvironment;
    state: string;
    codeChallenge: string;
  }
): string {
  const url = new URL(`https://${config.domain}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("audience", dashboardAudience(params.environment));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface Auth0Tokens {
  access_token: string;
  id_token: string;
}

export async function exchangeAuth0Code(
  config: Auth0Config,
  params: { code: string; redirectUri: string; verifier: string },
  fetchImpl: typeof fetch = fetch
): Promise<Auth0Tokens> {
  const response = await fetchImpl(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.verifier,
    }).toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OAuthStepError(
      "auth0_token",
      `Sign-in could not be completed (Auth0 answered HTTP ${response.status}).`,
      response.status,
      detail
    );
  }
  const body = (await response.json()) as Partial<Auth0Tokens>;
  if (!body.access_token || !body.id_token) {
    throw new OAuthStepError("auth0_token", "Sign-in returned no tokens.");
  }
  return { access_token: body.access_token, id_token: body.id_token };
}

// ---- Identity from the ID token --------------------------------------------

export interface Identity {
  sub: string;
  email?: string;
  name?: string;
  orgId?: string;
}

/**
 * The ID token came straight from Auth0's token endpoint over TLS in the
 * exchange above, so its claims are read without a signature check.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new OAuthStepError("identity", "Malformed ID token.");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function identityFromIdToken(idToken: string): Identity {
  const payload = decodeJwtPayload(idToken);
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) throw new OAuthStepError("identity", "ID token has no subject.");
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    orgId: typeof payload.org_id === "string" ? payload.org_id : undefined,
  };
}

// ---- Minting the tenant's API key ------------------------------------------

export interface MintedKey {
  apiKeyId: string;
  prefix: string;
  plaintextKey: string;
}

function explainMintFailure(status: number, environment: StablesEnvironment): string {
  switch (status) {
    case 401:
      return `Stables did not accept the sign-in for ${environment}. Pick an organisation that exists on ${environment}, or sign in again.`;
    case 403:
      return "Your role in this organisation can't create API keys. Ask an organisation admin to connect, or to grant you API-key access.";
    case 404:
      return `This organisation isn't set up on ${environment} yet.`;
    default:
      return `Stables answered HTTP ${status} while creating the agent's API key. Try again in a moment.`;
  }
}

export async function mintApiKey(
  params: {
    environment: StablesEnvironment;
    accessToken: string;
    name: string;
    metadata?: Record<string, string>;
  },
  fetchImpl: typeof fetch = fetch
): Promise<MintedKey> {
  const response = await fetchImpl(`${API_BASE[params.environment]}/dashboard/v1/api-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({ name: params.name, metadata: params.metadata }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OAuthStepError(
      "mint_key",
      explainMintFailure(response.status, params.environment),
      response.status,
      detail
    );
  }
  const body = (await response.json()) as {
    apiKey?: { apiKeyId?: string; prefix?: string };
    plaintextKey?: string;
  };
  if (!body.plaintextKey || !body.apiKey?.apiKeyId) {
    throw new OAuthStepError("mint_key", "Stables returned no API key.");
  }
  return {
    apiKeyId: body.apiKey.apiKeyId,
    prefix: body.apiKey.prefix ?? "",
    plaintextKey: body.plaintextKey,
  };
}

/** API keys are listed by name in the dashboard, so say which agent and who. */
export function apiKeyName(clientName: string, identity: Identity): string {
  const who = identity.email ?? identity.sub;
  return `${clientName} via MCP (${who})`.slice(0, 255);
}
