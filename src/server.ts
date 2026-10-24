/**
 * Builds a Stables MCP server bound to one API client.
 *
 * Every transport (stdio for local use, HTTP for the hosted service) goes
 * through here, so the tool surface is identical however the server is reached.
 */

import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StablesApiClient } from "./lib/stables-client.js";
import { FULL_ACCESS, TOOL_POLICY, allows, annotationsFor, type ToolGrant } from "./tool-policy.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerQuoteTools } from "./tools/quotes.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerVirtualAccountTools } from "./tools/virtual-accounts.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerSandboxTools } from "./tools/sandbox.js";
import { registerBalanceTools } from "./tools/balances.js";
import { registerEntitlementTools } from "./tools/entitlements.js";
import { registerComplianceTools } from "./tools/compliance.js";
import { registerDocumentTools } from "./tools/documents.js";

import { SERVER_VERSION } from "./version.js";

export const SERVER_NAME = "stables-mcp-server";
export { SERVER_VERSION };

export interface ServerOptions {
  /**
   * What this connection may do. Write tools stay listed for a read-only
   * connection (so a client can ask the person for more access when it needs
   * it); admin tools are removed when not granted. Defaults to everything,
   * which is what an API-key caller and the local stdio server get.
   */
  grant?: ToolGrant;
}

export function createStablesMcpServer(
  client: StablesApiClient,
  options: ServerOptions = {}
): McpServer {
  const grant = options.grant ?? FULL_ACCESS;
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description:
      "Stables fiat-to-crypto API for AI agents - manage customers, quotes, transfers, and virtual accounts",
  });

  // Capture every tool as it registers, so each gets its label below.
  const registered = new Map<string, RegisteredTool>();
  const register = server.tool.bind(server) as (...args: unknown[]) => RegisteredTool;
  (server as unknown as { tool: (...args: unknown[]) => RegisteredTool }).tool = (
    ...args: unknown[]
  ) => {
    const tool = register(...args);
    registered.set(String(args[0]), tool);
    return tool;
  };

  registerCustomerTools(server, client);
  registerQuoteTools(server, client);
  registerTransferTools(server, client);
  registerVirtualAccountTools(server, client);
  registerApiKeyTools(server, client);
  registerWebhookTools(server, client);
  registerBalanceTools(server, client);
  registerEntitlementTools(server, client);
  registerComplianceTools(server, client);
  registerDocumentTools(server, client);
  registerSandboxTools(server, client);

  for (const [name, tool] of registered) {
    const policy = TOOL_POLICY[name];
    if (!policy) {
      throw new Error(`Tool "${name}" has no entry in TOOL_POLICY (src/tool-policy.ts)`);
    }
    tool.update({ title: policy.title, annotations: annotationsFor(policy) });
    if (policy.access === "admin" && !allows(grant, "admin")) tool.disable();
  }

  return server;
}
