/**
 * Virtual Account Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
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
      destinationAddress: z.string().optional().describe("Crypto wallet address for payouts"),
      destinationPaymentRail: z.enum(["arbitrum", "avalanche_c_chain", "base", "celo", "ethereum", "optimism", "polygon", "solana", "stellar", "tron"]).optional()
        .describe("Blockchain network for the destination wallet"),
      destinationCurrency: z.enum(["usdc", "usdt", "dai", "pyusd", "eurc"]).optional()
        .describe("Stablecoin to receive (default: usdc)"),
    },
    async ({ customerId, sourceCurrency, depositHandlingMode, destinationAddress, destinationPaymentRail, destinationCurrency }) => {
      try {
        const request: {
          source: { currency: string };
          deposit_handling_mode?: "auto_payout" | "hold" | "manual";
          destination?: {
            currency: "usdc" | "usdt" | "dai" | "pyusd" | "eurc";
            payment_rail: "arbitrum" | "avalanche_c_chain" | "base" | "celo" | "ethereum" | "optimism" | "polygon" | "solana" | "stellar" | "tron";
            address: string;
          };
        } = {
          source: { currency: sourceCurrency },
          deposit_handling_mode: depositHandlingMode,
        };

        // Add destination if all required fields provided
        if (destinationAddress && destinationPaymentRail) {
          request.destination = {
            currency: destinationCurrency || "usdc",
            payment_rail: destinationPaymentRail,
            address: destinationAddress,
          };
        }

        const account = await client.createVirtualAccount(customerId, request);

        const instructions = account.source_deposit_instructions;
        let depositInfo = `Currency: ${instructions.currency}`;
        depositInfo += `\nPayment Rails: ${instructions.payment_rails.join(", ")}`;
        if (instructions.bank_name) depositInfo += `\nBank: ${instructions.bank_name}`;
        if (instructions.bank_account_number) depositInfo += `\nAccount Number: ${instructions.bank_account_number}`;
        if (instructions.bank_routing_number) depositInfo += `\nRouting Number: ${instructions.bank_routing_number}`;
        if (instructions.iban) depositInfo += `\nIBAN: ${instructions.iban}`;
        if (instructions.bic) depositInfo += `\nBIC: ${instructions.bic}`;
        if (instructions.account_holder_name) depositInfo += `\nAccount Holder: ${instructions.account_holder_name}`;

        const destInfo = account.destination
          ? `\nPayout Address: ${account.destination.address}\nPayment Rail: ${account.destination.payment_rail}\nCurrency: ${account.destination.currency}`
          : "\nNo payout destination configured";

        const balanceInfo = account.held_balance
          ? `\nHeld Balance: ${account.held_balance.amount} ${account.held_balance.currency}`
          : "";

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
${balanceInfo}
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

  // List Virtual Accounts (by customer)
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
          const dest = a.destination
            ? `Payout: ${a.destination.address.slice(0, 10)}... (${a.destination.payment_rail})`
            : "No payout destination";
          const balance = a.held_balance ? ` | Balance: ${a.held_balance.amount} ${a.held_balance.currency}` : "";
          return `- ${a.id}: ${a.source_deposit_instructions.currency} (${a.status}) - ${dest}${balance}`;
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

  // Update Virtual Account
  server.tool(
    "update_virtual_account",
    "Update virtual account settings (e.g., deposit handling mode)",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID to update"),
      depositHandlingMode: z.enum(["auto_payout", "hold", "manual"]).describe("New deposit handling mode"),
    },
    async ({ customerId, virtualAccountId, depositHandlingMode }) => {
      try {
        const account = await client.updateVirtualAccount(customerId, virtualAccountId, {
          deposit_handling_mode: depositHandlingMode,
        });

        return {
          content: [
            {
              type: "text",
              text: `Virtual account ${account.id} updated.
Deposit Mode: ${account.deposit_handling_mode}
Status: ${account.status}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update virtual account: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Deactivate Virtual Account
  server.tool(
    "deactivate_virtual_account",
    "Deactivate a virtual account to prevent new incoming transactions",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID to deactivate"),
    },
    async ({ customerId, virtualAccountId }) => {
      try {
        const account = await client.deactivateVirtualAccount(customerId, virtualAccountId);

        return {
          content: [
            {
              type: "text",
              text: `Virtual account ${account.id} has been deactivated. No new deposits will be accepted.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to deactivate virtual account: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Reactivate Virtual Account
  server.tool(
    "reactivate_virtual_account",
    "Reactivate a previously deactivated virtual account",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID to reactivate"),
    },
    async ({ customerId, virtualAccountId }) => {
      try {
        const account = await client.reactivateVirtualAccount(customerId, virtualAccountId);

        return {
          content: [
            {
              type: "text",
              text: `Virtual account ${account.id} has been reactivated. Status: ${account.status}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to reactivate virtual account: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Virtual Account History
  server.tool(
    "get_virtual_account_history",
    "Get the activity history for a virtual account (deposits, payouts, etc.)",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID"),
      limit: z.number().optional().describe("Maximum number of events to return (default: 10)"),
      eventType: z.enum(["funds_scheduled", "funds_received", "payment_submitted", "payment_processed", "in_review", "refund", "microdeposit", "account_update", "deactivation", "activation"]).optional()
        .describe("Filter by event type"),
    },
    async ({ customerId, virtualAccountId, limit, eventType }) => {
      try {
        const response = await client.getVirtualAccountHistory(customerId, virtualAccountId, {
          limit,
          event_type: eventType,
        });

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No activity found for virtual account ${virtualAccountId}.`,
              },
            ],
          };
        }

        const eventList = response.data.map((e) => {
          return `- ${e.created_at}: ${e.type} - ${e.amount} ${e.currency}${e.deposit_id ? ` (Deposit: ${e.deposit_id})` : ""}`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Virtual Account History (${response.count} events):

${eventList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get virtual account history: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
