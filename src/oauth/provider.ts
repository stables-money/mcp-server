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

import {
  ExternalTokenError,
  OAuthProvider,
  insufficientScope,
  type OAuthResourceAuth,
} from "@cloudflare/workers-oauth-provider";
import { FULL_ACCESS, TOOL_POLICY, type ToolGrant } from "../tool-policy.js";
import { SERVER_VERSION } from "../version.js";
import { serveMcp, withCors, json } from "../http/handler.js";
import { StablesApiClient, apiUrlForKey } from "../lib/stables-client.js";
import { environmentForKey } from "./auth0.js";
import { handleDefault } from "./handlers.js";
import {
  LEGACY_SCOPE,
  READ_SCOPE,
  SCOPE,
  SUPPORTED_SCOPES,
  WRITE_SCOPE,
  type GrantProps,
  type OAuthEnv,
} from "./types.js";

/**
 * What a connection may do. An API key presented directly keeps full access,
 * as before. An OAuth grant reads with `stables:read`, writes with
 * `stables:write` (or the legacy `stables`), and never gets admin tools.
 */
export function grantFor(props: GrantProps | undefined, scope: string[]): ToolGrant {
  if (props?.source === "api_key") return FULL_ACCESS;
  const write = scope.includes(WRITE_SCOPE) || scope.includes(LEGACY_SCOPE);
  const read = write || scope.includes(READ_SCOPE);
  return { read, write, admin: false };
}

/** Tool names a JSON-RPC body calls (one message or a batch). */
export async function calledTools(request: Request): Promise<string[]> {
  if (request.method !== "POST") return [];
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return [];
  }
  const messages = Array.isArray(body) ? body : [body];
  return messages
    .filter(
      (m): m is { method: string; params?: { name?: unknown } } =>
        !!m && typeof m === "object" && (m as { method?: unknown }).method === "tools/call"
    )
    .map((m) => (typeof m.params?.name === "string" ? m.params.name : ""))
    .filter(Boolean);
}

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
  props: GrantProps | undefined,
  auth: OAuthResourceAuth | undefined
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
  const grant = grantFor(props, auth?.scope ?? []);
  if (!grant.read) {
    return withCors(
      json({ error: "insufficient_scope", message: "This connection has no access." }, 403)
    );
  }
  // A read-only connection still lists the write tools, so the client knows
  // they exist; calling one answers 403 insufficient_scope naming the write
  // scope, which MCP clients answer by asking the person for more access.
  if (!grant.write && auth) {
    const writes = (await calledTools(request)).filter(
      (name) => TOOL_POLICY[name]?.access === "write"
    );
    if (writes.length > 0) {
      return withCors(
        insufficientScope(
          auth,
          [READ_SCOPE, WRITE_SCOPE],
          `${writes.join(", ")} changes your Stables account. Reconnect and allow "Read and make changes" to use it.`
        )
      );
    }
  }
  return withCors(await serveMcp(request, client, { grant }));
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
        const { props, auth } = ctx as { props?: GrantProps; auth?: OAuthResourceAuth };
        return serveAuthorizedMcp(request, env, props, auth);
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
      const props: GrantProps = {
        source: "api_key",
        apiKey: token,
        environment: environmentForKey(token),
      };
      return { props, audience: resource };
    },
  });
  providers.set(origin, provider);
  return provider;
}
