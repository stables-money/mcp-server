/**
 * The browser-facing half of the OAuth flow: the consent page at /authorize
 * and the Auth0 return at /callback. The provider owns everything else
 * (discovery, registration, the token endpoint) and hands requests without
 * a valid token to handleDefault.
 */

import {
  AuthorizationError,
  CimdFetchError,
  authorizationErrorRedirect,
  type AuthRequest,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { MCP_PATH, handleRequest, json, withCors } from "../http/handler.js";
import {
  OAuthStepError,
  apiKeyName,
  auth0AuthorizeUrl,
  auth0ConfigFrom,
  exchangeAuth0Code,
  identityFromIdToken,
  mintApiKey,
  parseEnvironment,
  randomVerifier,
  revokeApiKey,
  s256,
} from "./auth0.js";
import { consentPage, errorPage } from "./pages.js";
import {
  CONNECTION_TTL_SECONDS,
  LEGACY_SCOPE,
  READ_SCOPE,
  SCOPE,
  WRITE_SCOPE,
  type GrantProps,
  type OAuthEnv,
  type StablesEnvironment,
} from "./types.js";

/** What beginUpstream() keeps for us until Auth0 sends the user back. */
interface UpstreamData {
  environment: StablesEnvironment;
  verifier: string;
  scope: string[];
}

function html(body: string, status = 200, headers?: Headers): Response {
  const h = new Headers(headers);
  h.set("content-type", "text/html; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(body, { status, headers: h });
}

function redirect(headers: Headers, location?: string): Response {
  if (location) headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

function publicOrigin(request: Request, env: OAuthEnv): string {
  return (env.MCP_PUBLIC_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

/**
 * The scopes a grant gets: always read; write only when the person chose
 * "make changes"; offline_access when the client asked for refresh tokens.
 */
export function grantScope(requested: string[], allowChanges: boolean): string[] {
  const scope = [READ_SCOPE];
  if (allowChanges) scope.push(WRITE_SCOPE);
  if (requested.includes("offline_access")) scope.push("offline_access");
  return scope;
}

/** Whether the client asked for write access (or the legacy all-access scope). */
export function requestsChanges(requested: string[]): boolean {
  return requested.includes(WRITE_SCOPE) || requested.includes(LEGACY_SCOPE);
}

export async function handleDefault(request: Request, env: OAuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/authorize" || path === "/callback") {
    const oauth = env.OAUTH_PROVIDER;
    if (!oauth) {
      return html(errorPage("Sign-in unavailable", "OAuth is not configured on this server."), 503);
    }
    try {
      if (path === "/authorize" && request.method === "GET") {
        return await authorizeGet(request, env, oauth);
      }
      if (path === "/authorize" && request.method === "POST") {
        return await authorizePost(request, env, oauth);
      }
      if (path === "/callback" && request.method === "GET") {
        return await callback(request, env, oauth);
      }
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
    } catch (error) {
      return renderOAuthError(error);
    }
  }

  // The provider sends an /mcp request here only when it carries no valid
  // token. Answer with the spec's challenge so clients find the metadata.
  if (path === MCP_PATH || path === `${MCP_PATH}/`) {
    const origin = publicOrigin(request, env);
    return withCors(
      json(
        {
          error: "unauthorized",
          message:
            "Send a Stables API key as a bearer token, or connect with OAuth (see WWW-Authenticate).",
          docs: "https://docs.stables.money/get-started/getting-started/quickstart/building-with-ai",
        },
        401,
        {
          "www-authenticate": `Bearer realm="OAuth", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${SCOPE}"`,
        }
      )
    );
  }

  return handleRequest(request);
}

async function authorizeGet(
  request: Request,
  env: OAuthEnv,
  oauth: OAuthHelpers
): Promise<Response> {
  if (!auth0ConfigFrom(env)) {
    return html(
      errorPage("Sign-in unavailable", "This server has no identity provider configured yet."),
      503
    );
  }
  const authRequest = await oauth.parseAuthRequest(request);
  // describeConsent first: a failed client lookup leaves nothing in KV.
  const details = await oauth.describeConsent(authRequest);
  const consent = await oauth.beginConsent(authRequest);
  return html(
    consentPage(details, consent.handle, { requestsChanges: requestsChanges(authRequest.scope) }),
    200,
    consent.headers
  );
}

async function authorizePost(
  request: Request,
  env: OAuthEnv,
  oauth: OAuthHelpers
): Promise<Response> {
  const config = auth0ConfigFrom(env);
  if (!config) {
    return html(
      errorPage("Sign-in unavailable", "This server has no identity provider configured yet."),
      503
    );
  }
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return redirect(denied.headers);
  }

  const environment = parseEnvironment(form.get("environment"));
  if (!environment) {
    return html(
      errorPage("Pick an environment", "Choose Sandbox or Production and try again."),
      400
    );
  }

  const approved = await oauth.approveConsent(request, handle);
  const scope = grantScope(approved.request.scope, form.get("access") === "write");
  const verifier = randomVerifier();
  const data: UpstreamData = { environment, verifier, scope };
  const { state, headers } = await oauth.beginUpstream(approved.request, {
    data,
    headers: approved.headers,
  });
  const location = auth0AuthorizeUrl(config, {
    redirectUri: `${publicOrigin(request, env)}/callback`,
    environment,
    state,
    codeChallenge: await s256(verifier),
  });
  return redirect(headers, location);
}

async function callback(request: Request, env: OAuthEnv, oauth: OAuthHelpers): Promise<Response> {
  const config = auth0ConfigFrom(env);
  if (!config) {
    return html(
      errorPage("Sign-in unavailable", "This server has no identity provider configured yet."),
      503
    );
  }
  const { request: original, data, headers } = await oauth.finishUpstream<UpstreamData>(request);
  const params = new URL(request.url).searchParams;

  if (params.get("error")) {
    return redirect(headers, authorizationErrorRedirect(original, "access_denied"));
  }
  const code = params.get("code");
  if (!code) throw new OAuthStepError("callback", "Auth0 sent the user back without a code.");

  const origin = publicOrigin(request, env);
  const tokens = await exchangeAuth0Code(config, {
    code,
    redirectUri: `${origin}/callback`,
    verifier: data.verifier,
  });
  const identity = identityFromIdToken(tokens.id_token, config);
  if (!identity.mfa) {
    // The post-login action requires MFA for this client, so a token without
    // it means that action was bypassed or changed.
    console.warn(
      JSON.stringify({ event: "oauth_signin_without_mfa", environment: data.environment, sub: identity.sub })
    );
    if (env.MCP_REQUIRE_MFA === "enforce") {
      throw new OAuthStepError(
        "identity",
        "This sign-in did not use two-factor authentication. Set up an authenticator for your Stables account, then connect again."
      );
    }
  }
  const clientName = (await clientNameFor(oauth, original)) ?? "MCP client";
  const canWrite = data.scope.includes(WRITE_SCOPE);

  const minted = await mintApiKey({
    environment: data.environment,
    accessToken: tokens.access_token,
    name: apiKeyName(clientName, identity),
    metadata: {
      source: "mcp_oauth",
      client: clientName,
      user: identity.email ?? identity.sub,
      access: canWrite ? "read_write" : "read",
    },
    // The key ends with the connection, and a read-only connection's key is
    // read-only at the API too, not just in this server.
    expiresAt: new Date(Date.now() + CONNECTION_TTL_SECONDS * 1000).toISOString(),
    access: canWrite ? "full" : "read",
  });

  const props: GrantProps = {
    source: "oauth",
    apiKey: minted.plaintextKey,
    apiKeyId: minted.apiKeyId,
    environment: data.environment,
    email: identity.email,
    orgId: identity.orgId,
    clientName,
  };
  // One grant per user, organisation and environment, so re-authorising
  // sandbox never revokes a production grant for the same person.
  const userId = [data.environment, identity.orgId ?? "-", identity.sub]
    .join("|")
    .replace(/:/g, "_");
  // Read before completeAuthorization, which drops earlier grants of the
  // same client by itself but never the keys behind them.
  const previous = await previousConnections(oauth, userId, clientName);
  const { redirectTo } = await oauth.completeAuthorization({
    request: original,
    userId,
    metadata: {
      environment: data.environment,
      client: clientName,
      email: identity.email,
      orgId: identity.orgId,
      apiKeyId: minted.apiKeyId,
      keyPrefix: minted.prefix,
    },
    scope: data.scope,
    props,
  });
  await retireConnections(oauth, previous, {
    userId,
    environment: data.environment,
    accessToken: tokens.access_token,
    keepApiKeyId: minted.apiKeyId,
  });
  return redirect(headers, redirectTo);
}

interface PreviousConnection {
  grantId: string;
  apiKeyId: string;
}

/**
 * This person's earlier connections from the same client to the same
 * organisation and environment. Reconnecting replaces them, so each one's
 * key would otherwise stay live in the dashboard with nothing using it.
 * Other clients (ChatGPT next to Claude) are left alone.
 */
async function previousConnections(
  oauth: OAuthHelpers,
  userId: string,
  clientName: string
): Promise<PreviousConnection[]> {
  const found: PreviousConnection[] = [];
  let cursor: string | undefined;
  do {
    const page = await oauth.listUserGrants(userId, { cursor });
    for (const grant of page.items) {
      const metadata = (grant.metadata ?? {}) as { client?: string; apiKeyId?: string };
      if (metadata.client === clientName && metadata.apiKeyId) {
        found.push({ grantId: grant.id, apiKeyId: metadata.apiKeyId });
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return found;
}

/**
 * Revokes the replaced connections' keys and grants. Best effort: the new
 * connection already works, so a failure here is logged, never shown.
 */
async function retireConnections(
  oauth: OAuthHelpers,
  previous: PreviousConnection[],
  params: {
    userId: string;
    environment: StablesEnvironment;
    accessToken: string;
    keepApiKeyId: string;
  }
): Promise<void> {
  const stale = previous.filter((p) => p.apiKeyId !== params.keepApiKeyId);
  const results = await Promise.allSettled(
    stale.map(async (p) => {
      await revokeApiKey({
        environment: params.environment,
        accessToken: params.accessToken,
        apiKeyId: p.apiKeyId,
      });
      // completeAuthorization may already have dropped it (same client).
      await oauth.revokeGrant(p.grantId, params.userId).catch(() => undefined);
    })
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: "oauth_retire_previous_failed",
        failed: failed.length,
        of: stale.length,
        reason: String((failed[0] as PromiseRejectedResult).reason).slice(0, 300),
      })
    );
  }
}

async function clientNameFor(
  oauth: OAuthHelpers,
  authRequest: AuthRequest
): Promise<string | null> {
  try {
    const client = await oauth.lookupClient(authRequest.clientId);
    const name = client?.clientName?.trim();
    return name ? name.slice(0, 80) : null;
  } catch {
    return null;
  }
}

function renderOAuthError(error: unknown): Response {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  if (error instanceof AuthorizationError) {
    return html(
      errorPage(
        "Connection request expired",
        error.description ||
          "This page was already used, opened in another browser, or has expired."
      ),
      400
    );
  }
  if (error instanceof CimdFetchError) {
    return html(
      errorPage("App could not be verified", "The app's identity document could not be fetched."),
      400
    );
  }
  if (error instanceof OAuthStepError) {
    // Workers Logs is the only place to see why a sign-in failed server-side.
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: "oauth_step_failed",
        step: error.step,
        status: error.status,
        detail: error.detail?.slice(0, 300),
      })
    );
    return html(errorPage("Connection failed", error.message), error.status === 403 ? 403 : 400);
  }
  throw error;
}
