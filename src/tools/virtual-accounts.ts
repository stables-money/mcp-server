/**
 * Virtual Account Tools for Stables MCP Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerVirtualAccountTools(server: McpServer, client: StablesApiClient) {
  // Create Virtual Account
  server.tool(
    "create_virtual_account",
    "Create a virtual bank account for a customer to receive fiat deposits. Deposits can automatically convert to crypto and payout to a wallet.",
    {
      customerId: z.string().describe("The customer ID to create the virtual account for"),
      sourceCurrency: z.string().describe("Currency for the virtual account (e.g., 'USD', 'EUR', 'GBP')"),
      depositHandlingMode: z.enum(["auto_payout", "hold", "manual"]).optional()
        .describe("How to handle deposits: 'auto_payout' converts and sends to wallet, 'hold' keeps as fiat, 'manual' requires approval"),
      destinationAddress: z.string().optional().describe("Crypto wallet address for auto-payout"),
      destinationNetwork: z.enum(["arbitrum", "avalanche_c_chain", "base", "ethereum", "optimism", "polygon", "solana", "stellar", "tron"]).optional()
        .describe("Blockchain network for the destination wallet"),
      destinationCurrency: z.enum(["usdc", "usdt", "dai", "pyusd", "eurc"]).optional()
        .describe("Stablecoin to receive (default: usdc)"),
    },
    async ({ customerId, sourceCurrency, depositHandlingMode, destinationAddress, destinationNetwork, destinationCurrency }) => {
      try {
        const request: {
          source: { currency: string };
          deposit_handling_mode?: "auto_payout" | "hold" | "manual";
          initial_destination?: {
            currency: "usdc" | "usdt" | "dai" | "pyusd" | "eurc";
            network: "arbitrum" | "avalanche_c_chain" | "base" | "ethereum" | "optimism" | "polygon" | "solana" | "stellar" | "tron";
            address: string;
          };
        } = {
          source: { currency: sourceCurrency },
          deposit_handling_mode: depositHandlingMode,
        };

        // Add destination if all required fields provided
        if (destinationAddress && destinationNetwork) {
          request.initial_destination = {
            currency: destinationCurrency || "usdc",
            network: destinationNetwork,
            address: destinationAddress,
          };
        }

        const account = await client.createVirtualAccount(customerId, request);

        const instructions = account.source_deposit_instructions;
        let depositInfo = `Currency: ${instructions.currency}`;
        if (instructions.bank_name) depositInfo += `\nBank: ${instructions.bank_name}`;
        if (instructions.bank_account_number) depositInfo += `\nAccount Number: ${instructions.bank_account_number}`;
        if (instructions.bank_routing_number) depositInfo += `\nRouting Number: ${instructions.bank_routing_number}`;

        const destInfo = account.active_destination
          ? `\nPayout Address: ${account.active_destination.address}\nNetwork: ${account.active_destination.network}\nCurrency: ${account.active_destination.currency}`
          : "\nNo payout destination configured";

        return {
          content: [
            {
              type: "text",
              text: `Virtual Account created successfully!

Account ID: ${account.id}
Status: ${account.status}
Customer ID: ${account.customer_id}
Deposit Mode: ${account.deposit_handling_mode}

Deposit Instructions:
${depositInfo}

Payout Destination:${destInfo}

Created: ${account.created_at}

Share the deposit instructions with the customer to receive funds.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create virtual account: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Virtual Accounts
  server.tool(
    "list_virtual_accounts",
    "List all virtual accounts for a customer",
    {
      customerId: z.string().describe("The customer ID to list virtual accounts for"),
      status: z.enum(["activated", "deactivated", "pending", "closed"]).optional()
        .describe("Filter by account status"),
      limit: z.number().optional().describe("Maximum number of accounts to return"),
    },
    async ({ customerId, status, limit }) => {
      try {
        const response = await client.listVirtualAccounts(customerId, { status, limit });

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No virtual accounts found for customer ${customerId}. Use 'create_virtual_account' to create one.`,
              },
            ],
          };
        }

        const accountList = response.data.map((a) => {
          const dest = a.active_destination
            ? `Payout: ${a.active_destination.address.slice(0, 10)}...`
            : "No payout destination";
          return `- ${a.id}: ${a.source_deposit_instructions.currency} (${a.status}) - ${dest}`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Virtual Accounts for Customer ${customerId} (${response.count} total):

${accountList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list virtual accounts: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
