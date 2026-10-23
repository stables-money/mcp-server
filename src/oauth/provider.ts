/**
 * The OAuth provider the Worker runs: authorization server and protected
 * resource in one, as @cloudflare/workers-oauth-provider's OAuthProvider.
 *
 * - /mcp is the protected resource. A grant's props carry the Stables API key
 *   minted at sign-in, and the request is served with it.
 * - A plain Stables API key sent as a bearer token keeps working through
 *   resolveExternalToken, so coding agents configured with a key need no
 *   OAuth.
 * - /.well-known/oauth-protected-resource/mcp, /.well-known/oauth-authorization-server,
 *   /oauth/token and /oauth/register are the provider's; /authorize and
 *   /callback are ours (handlers.ts).
 */

import { ExternalTokenError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { SERVER_VERSION } from "../version.js";
import { serveMcp, withCors, json } from "../http/handler.js";
import { StablesApiClient, apiUrlForKey } from "../lib/stables-client.js";
import { environmentForKey } from "./auth0.js";
import { handleDefault } from "./handlers.js";
import { SCOPE, SUPPORTED_SCOPES, type GrantProps, type OAuthEnv } from "./types.js";

export function resourceFor(origin: string): string {
  return `${origin}/mcp`;
}

export function apiClientFor(apiKey: string, env: OAuthEnv): StablesApiClient | null {
  const baseUrl = apiUrlForKey(apiKey);
  if (!baseUrl) return null;
  return new StablesApiClient(apiKey, baseUrl, {
    gatewaySigningSecret: env.MCP_GATEWAY_SIGNING_SECRET,
    userAgent: `stables-mcp-server/${SERVER_VERSION} (hosted)`,
  });
}

async function serveAuthorizedMcp(
  request: Request,
  env: OAuthEnv,
  props: GrantProps | undefined
): Promise<Response> {
  const client = props?.apiKey ? apiClientFor(props.apiKey, env) : null;
  if (!client) {
    return withCors(
      json(
        {
          error: "invalid_grant",
          message:
            "This connection carries no usable Stables API key. Disconnect and connect again.",
        },
        401
      )
    );
  }
  return withCors(await serveMcp(request, client));
}

const providers = new Map<string, OAuthProvider<OAuthEnv>>();

/** One provider per public origin; metadata and token audiences are bound to it. */
export function providerFor(origin: string): OAuthProvider<OAuthEnv> {
  const cached = providers.get(origin);
  if (cached) return cached;

  const resource = resourceFor(origin);
  const provider = new OAuthProvider<OAuthEnv>({
    apiRoute: "/mcp",
    apiHandler: {
      fetch(request: Request, env: OAuthEnv, ctx: unknown) {
        const props = (ctx as { props?: GrantProps }).props;
        return serveAuthorizedMcp(request, env, props);
      },
    },
    defaultHandler: {
      fetch(request: Request, env: OAuthEnv) {
        return handleDefault(request, env);
      },
    },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    // DCR stays on for clients without CIMD support; MCP prefers CIMD.
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: SUPPORTED_SCOPES,
    requiredScopes: [SCOPE],
    resourceMetadata: {
      resource,
      authorization_servers: [origin],
      resource_name: "Stables MCP server",
    },
    accessTokenTTL: 60 * 60,
    refreshTokenTTL: 30 * 24 * 60 * 60,
    // A Stables API key presented directly. Sandbox keys go to sandbox and
    // live keys to production, as the stdio server does.
    resolveExternalToken: async ({ token }) => {
      if (!token.startsWith("sti_")) return null;
      if (!apiUrlForKey(token)) {
        throw new ExternalTokenError("invalid_token", {
          description:
            "Unrecognised API key. Send a sti_test_ (sandbox) or sti_live_ (production) key, or connect with OAuth.",
          statusCode: 401,
        });
      }
      const props: GrantProps = { apiKey: token, environment: environmentForKey(token) };
      return { props, audience: resource };
    },
  });
  providers.set(origin, provider);
  return provider;
}
