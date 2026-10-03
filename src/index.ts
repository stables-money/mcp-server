#!/usr/bin/env node
/**
 * Stables MCP Server — stdio entry point.
 *
 * This is what `npx stables-mcp-server` runs: a local process that speaks MCP
 * over stdin/stdout and authenticates to the Stables API with the key in
 * STABLES_API_KEY. The hosted service at https://mcp.stables.money/mcp exposes
 * the same tools over HTTP without installing anything; see README.md.
 *
 * Usage:
 *   STABLES_API_KEY=your-key node build/index.js
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStablesClient } from "./lib/stables-client.js";
import { createStablesMcpServer } from "./server.js";

// Validate environment
const apiKey = process.env.STABLES_API_KEY;
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.error("Error: STABLES_API_KEY environment variable is required");
  process.exit(1);
}

async function main() {
  const server = createStablesMcpServer(createStablesClient());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
