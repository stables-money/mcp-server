#!/usr/bin/env node
/**
 * Stables MCP Server
 *
 * This server exposes the Stables fiat-to-crypto API to AI agents via the
 * Model Context Protocol (MCP). It enables AI assistants to manage customers,
 * create quotes, execute transfers, and handle virtual accounts.
 *
 * Usage:
 *   STABLES_API_KEY=your-key node build/index.js
 *
 * For Claude Desktop, add to ~/Library/Application Support/Claude/claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "stables": {
 *         "command": "node",
 *         "args": ["/path/to/stables-mcp-server/build/index.js"],
 *         "env": {
 *           "STABLES_API_KEY": "your-api-key",
 *           "STABLES_API_URL": "https://api.sandbox.stables.money"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStablesClient } from "./lib/stables-client.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerQuoteTools } from "./tools/quotes.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerVirtualAccountTools } from "./tools/virtual-accounts.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerWebhookTools } from "./tools/webhooks.js";

// Validate environment
const apiKey = process.env.STABLES_API_KEY;
if (!apiKey) {
  console.error("Error: STABLES_API_KEY environment variable is required");
  process.exit(1);
}

// Create the MCP server
const server = new McpServer({
  name: "stables-mcp-server",
  version: "1.0.0",
  description: "Stables fiat-to-crypto API for AI agents - manage customers, quotes, transfers, and virtual accounts",
});

// Create the Stables API client
const stablesClient = createStablesClient();

// Register all tools
registerCustomerTools(server, stablesClient);
registerQuoteTools(server, stablesClient);
registerTransferTools(server, stablesClient);
registerVirtualAccountTools(server, stablesClient);
registerApiKeyTools(server, stablesClient);
registerWebhookTools(server, stablesClient);

// Start the server with STDIO transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
