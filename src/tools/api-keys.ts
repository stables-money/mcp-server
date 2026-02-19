/**
 * API Key Management Tools for Stables MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerApiKeyTools(server: McpServer, client: StablesApiClient) {
  // Create API Key
  server.tool(
    "create_api_key",
    "Create a new API key for accessing the Stables API. The secret key is only shown once on creation - save it immediately.",
    {
      name: z.string().describe("A descriptive name for this API key (e.g., 'Production Bot', 'Agent Smith')"),
      metadata: z.record(z.string()).optional().describe("Optional metadata to attach to the key"),
    },
    async ({ name, metadata }) => {
      try {
        const result = await client.createApiKey({ name, metadata });

        const key = result.apiKey;

        return {
          content: [
            {
              type: "text",
              text: `API Key created successfully!

Key ID: ${key.apiKeyId}
Name: ${key.name}
Prefix: ${key.prefix}
Active: ${key.active ? "Yes" : "No"}
Created: ${key.createdAt}

SECRET KEY: ${result.plaintextKey}

IMPORTANT: Save the secret key now! It will not be shown again.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create API key: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List API Keys
  server.tool(
    "list_api_keys",
    "List all API keys for the current account",
    {
      pageSize: z.number().optional().describe("Number of keys per page"),
      pageToken: z.string().optional().describe("Token for the next page"),
    },
    async ({ pageSize, pageToken }) => {
      try {
        const response = await client.listApiKeys({ pageSize, pageToken });

        if (response.apiKeys.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No API keys found. Use 'create_api_key' to create one.",
              },
            ],
          };
        }

        const keyList = response.apiKeys.map((k) => {
          const id = k.apiKeyId || k.id;
          const status = k.active !== false ? "Active" : "Revoked";
          return `- ${id}: "${k.name}" (${k.prefix}...) - ${status} - Created: ${k.createdAt}`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `API Keys (${response.apiKeys.length}):

${keyList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list API keys: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get API Key
  server.tool(
    "get_api_key",
    "Get details about a specific API key",
    {
      apiKeyId: z.string().describe("The API key ID to look up"),
    },
    async ({ apiKeyId }) => {
      try {
        const key = await client.getApiKey(apiKeyId);

        const id = key.apiKeyId || key.id;

        return {
          content: [
            {
              type: "text",
              text: `API Key Details:

Key ID: ${id}
Name: ${key.name}
Prefix: ${key.prefix}
Active: ${key.active !== false ? "Yes" : "No"}
Created: ${key.createdAt}
${key.updatedAt ? `Updated: ${key.updatedAt}` : ""}
${key.lastUsedAt ? `Last Used: ${key.lastUsedAt}` : "Never used"}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get API key: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Revoke API Key
  server.tool(
    "revoke_api_key",
    "Revoke an API key. This permanently disables the key and cannot be undone.",
    {
      apiKeyId: z.string().describe("The API key ID to revoke"),
    },
    async ({ apiKeyId }) => {
      try {
        await client.revokeApiKey(apiKeyId);

        return {
          content: [
            {
              type: "text",
              text: `API key ${apiKeyId} has been revoked successfully. This key can no longer be used to access the API.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to revoke API key: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
