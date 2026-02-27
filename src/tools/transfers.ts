/**
 * Transfer Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerTransferTools(server: McpServer, client: StablesApiClient) {
  // Create Transfer
  server.tool(
    "create_transfer",
    "Execute a transfer using an active quote. The quote must not be expired. This initiates the actual money movement. Bank/payment details are already associated with the quote, so only customerId and quoteId are needed.",
    {
      customerId: z.string().describe("The customer ID for this transfer"),
      quoteId: z.string().describe("The quote ID to execute"),
      metadata: z.record(z.string()).optional().describe("Optional metadata to attach to the transfer"),
    },
    async ({ customerId, quoteId, metadata }) => {
      try {
        const transfer = await client.createTransfer({
          customerId,
          quoteId,
          metadata,
        });

        const typeDisplay = transfer.type === "TRANSFER_TYPE_ONRAMP" ? "On-ramp (Fiat to Crypto)" : "Off-ramp (Crypto to Fiat)";

        let collectionInfo = "";
        if (transfer.collectionInstructions) {
          const ci = transfer.collectionInstructions;
          collectionInfo = `
Collection Instructions (share with customer):
  Wallet Address: ${ci.walletAddress}
  Currency: ${ci.currency}
  Network: ${ci.network}
  Amount: ${ci.amount}

The customer must send the specified amount to this wallet address. Once received, Stables will process the payout to the bank account.`;
        }

        return {
          content: [
            {
              type: "text",
              text: `Transfer created successfully!

Transfer ID: ${transfer.id}
Type: ${typeDisplay}
Status: ${transfer.status}
Customer ID: ${transfer.customerId}
Quote ID: ${transfer.quoteId}

Created: ${transfer.createdAt}
${collectionInfo}

Use 'get_transfer' to check the status.`,
            },
          ],
        };
      } catch (error: unknown) {
        const apiError = error as { message?: string; statusCode?: number; errorBody?: unknown };
        const details = apiError.errorBody ? `\nAPI Response: ${JSON.stringify(apiError.errorBody, null, 2)}` : "";
        const status = apiError.statusCode ? ` (HTTP ${apiError.statusCode})` : "";
        return {
          content: [
            {
              type: "text",
              text: `Failed to create transfer${status}: ${error instanceof Error ? error.message : "Unknown error"}${details}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Transfer
  server.tool(
    "get_transfer",
    "Get the current status and details of a transfer",
    {
      transferId: z.string().describe("The transfer ID to look up"),
    },
    async ({ transferId }) => {
      try {
        const transfer = await client.getTransfer(transferId);

        const typeDisplay = transfer.type === "TRANSFER_TYPE_ONRAMP" ? "On-ramp (Fiat to Crypto)" : "Off-ramp (Crypto to Fiat)";

        let statusInfo = "";
        switch (transfer.status) {
          case "PENDING":
            statusInfo = "Transfer is waiting to be processed.";
            break;
          case "IN_PROGRESS":
            statusInfo = "Transfer is being processed.";
            break;
          case "COMPLETED":
            statusInfo = "Transfer completed successfully!";
            break;
          case "FAILED":
            statusInfo = "Transfer failed. Check with support for details.";
            break;
          case "CANCELLED":
            statusInfo = "Transfer was cancelled.";
            break;
          case "EXPIRED":
            statusInfo = "Transfer expired before completion.";
            break;
        }

        let collectionInfo = "";
        if (transfer.collectionInstructions) {
          const ci = transfer.collectionInstructions;
          collectionInfo = `
Collection Instructions:
  Wallet Address: ${ci.walletAddress}
  Currency: ${ci.currency}
  Network: ${ci.network}
  Amount: ${ci.amount}`;
        }

        return {
          content: [
            {
              type: "text",
              text: `Transfer Details:

Transfer ID: ${transfer.id}
Type: ${typeDisplay}
Status: ${transfer.status}
Customer ID: ${transfer.customerId}
Quote ID: ${transfer.quoteId}

Created: ${transfer.createdAt}
Updated: ${transfer.updatedAt}
${collectionInfo}

${statusInfo}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get transfer: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Transfers
  server.tool(
    "list_transfers",
    "List transfers with optional filters for status, type, or customer",
    {
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]).optional()
        .describe("Filter by transfer status"),
      type: z.enum(["TRANSFER_TYPE_ONRAMP", "TRANSFER_TYPE_OFFRAMP"]).optional()
        .describe("Filter by transfer type"),
      customerId: z.string().optional().describe("Filter by customer ID"),
      pageSize: z.number().optional().describe("Number of transfers per page (default: 20)"),
      pageToken: z.string().optional().describe("Token for the next page of results"),
    },
    async ({ status, type, customerId, pageSize, pageToken }) => {
      try {
        const response = await client.listTransfers({
          status,
          type,
          customerId,
          pageSize,
          pageToken,
        });

        if (response.transfers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No transfers found matching your criteria.",
              },
            ],
          };
        }

        const transferList = response.transfers.map((t) => {
          const typeShort = t.type === "TRANSFER_TYPE_ONRAMP" ? "On-ramp" : "Off-ramp";
          return `- ${t.id}: ${typeShort} - ${t.status} (Customer: ${t.customerId})`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Transfers (${response.transfers.length} of ${response.page.total}):

${transferList}
${response.page.nextPageToken ? `\nMore results available. Use pageToken: "${response.page.nextPageToken}"` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list transfers: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
