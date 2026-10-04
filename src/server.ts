/**
 * Builds a Stables MCP server bound to one API client.
 *
 * Every transport (stdio for local use, HTTP for the hosted service) goes
 * through here, so the tool surface is identical however the server is reached.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StablesApiClient } from "./lib/stables-client.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerQuoteTools } from "./tools/quotes.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerVirtualAccountTools } from "./tools/virtual-accounts.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerSandboxTools } from "./tools/sandbox.js";

import { SERVER_VERSION } from "./version.js";

export const SERVER_NAME = "stables-mcp-server";
export { SERVER_VERSION };

export function createStablesMcpServer(client: StablesApiClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description:
      "Stables fiat-to-crypto API for AI agents - manage customers, quotes, transfers, and virtual accounts",
  });

  registerCustomerTools(server, client);
  registerQuoteTools(server, client);
  registerTransferTools(server, client);
  registerVirtualAccountTools(server, client);
  registerApiKeyTools(server, client);
  registerWebhookTools(server, client);
  registerSandboxTools(server, client);

  return server;
}
