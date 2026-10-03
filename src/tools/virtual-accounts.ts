/**
 * Virtual Account Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerVirtualAccountTools(server: McpServer, client: StablesApiClient) {
  // Create Virtual Account
  server.tool(
    "create_virtual_account",
    "Create a payment route (virtual bank account) so a customer can receive fiat deposits that convert to a stablecoin and pay out to a wallet. " +
      "The payout destination is mandatory: the API refuses a fiat-to-crypto route without one. " +
      "Deposit handling is set server-side and defaults to auto_payout; change it afterwards with update_virtual_account.",
    {
      customerId: z.string().describe("The customer ID to create the payment route for"),
      sourceCurrency: z
        .string()
        .describe("Fiat currency the route collects in (e.g. 'AUD', 'USD', 'EUR')"),
      destinationAddress: z
        .string()
        .describe("Wallet address deposits are paid out to. Validated against the chosen network"),
      destinationPaymentRail: z
        .enum([
          "arbitrum",
          "avalanche_c_chain",
          "base",
          "celo",
          "ethereum",
          "optimism",
          "polygon",
          "solana",
          "stellar",
          "tron",
        ])
        .describe("Blockchain network the payout address belongs to"),
      destinationCurrency: z
        .enum(["usdc", "usdt", "dai", "pyusd", "eurc"])
        .default("usdt")
        .describe("Stablecoin to receive"),
      developerFeePercent: z
        .string()
        .optional()
        .describe("Your fee on each deposit, as a numeric string (e.g. '0.5')"),
    },
    async ({
      customerId,
      sourceCurrency,
      destinationAddress,
      destinationPaymentRail,
      destinationCurrency,
      developerFeePercent,
    }) => {
      try {
        // deposit_handling_mode is deliberately absent: it is not part of the
        // create schema and was silently ignored here. The server sets it, and
        // update_virtual_account changes it.
        const request = {
          source: { currency: sourceCurrency },
          workflow_type: "fiat_to_crypto" as const,
          destination: {
            currency: destinationCurrency,
            payment_rail: destinationPaymentRail,
            address: destinationAddress,
          },
          ...(developerFeePercent && { developer_fee_percent: developerFeePercent }),
        };

        const account = await client.createVirtualAccount(customerId, request);

        const instructions = account.source_deposit_instructions;
        let depositInfo = `Currency: ${instructions.currency}`;
        depositInfo += `\nPayment Rails: ${instructions.payment_rails.join(", ")}`;
        if (instructions.bank_name) depositInfo += `\nBank: ${instructions.bank_name}`;
        if (instructions.bank_account_number)
          depositInfo += `\nAccount Number: ${instructions.bank_account_number}`;
        if (instructions.bank_routing_number)
          depositInfo += `\nRouting Number: ${instructions.bank_routing_number}`;
        if (instructions.iban) depositInfo += `\nIBAN: ${instructions.iban}`;
        if (instructions.bic) depositInfo += `\nBIC: ${instructions.bic}`;
        if (instructions.account_holder_name)
          depositInfo += `\nAccount Holder: ${instructions.account_holder_name}`;

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
      status: z
        .enum(["activated", "deactivated", "pending", "closed"])
        .optional()
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

        const accountList = response.data
          .map((a) => {
            const dest = a.destination
              ? `Payout: ${a.destination.address.slice(0, 10)}... (${a.destination.payment_rail})`
              : "No payout destination";
            const balance = a.held_balance
              ? ` | Balance: ${a.held_balance.amount} ${a.held_balance.currency}`
              : "";
            return `- ${a.id}: ${a.source_deposit_instructions.currency} (${a.status}) - ${dest}${balance}`;
          })
          .join("\n");

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
      depositHandlingMode: z
        .enum(["auto_payout", "hold", "manual"])
        .describe("New deposit handling mode"),
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

  // Get Virtual Account History
  server.tool(
    "get_virtual_account_history",
    "Get the activity history for a virtual account (deposits, payouts, etc.)",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID"),
      limit: z.number().optional().describe("Maximum number of events to return (default: 10)"),
    },
    async ({ customerId, virtualAccountId, limit }) => {
      try {
        const response = await client.getVirtualAccountHistory(customerId, virtualAccountId, {
          limit,
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

        // Each row is a deposit and the payout it triggered. The old rendering
        // read type/amount/currency, none of which exist on these records, so
        // every line printed "undefined: undefined undefined".
        const eventList = response.data
          .map((e) => {
            const when = e.deposited_at ?? e.created_at ?? "-";
            const deposit = `${e.deposit_amount ?? "-"} ${e.deposit_currency ?? ""}`.trim();
            const payout =
              e.payout_status || e.payout_amount
                ? ` → payout ${e.payout_status ?? "?"}${
                    e.payout_amount
                      ? ` ${e.payout_amount} ${e.payout_currency ?? ""}`.trimEnd()
                      : ""
                  }`
                : "";
            const sender = e.sender_name ? ` from ${e.sender_name}` : "";
            return `- ${when}: deposit ${deposit}${sender}${payout}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Payment Route Activity (${response.data.length} record${response.data.length === 1 ? "" : "s"}${response.has_more ? ", more available" : ""}):

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

  // Update the payout destination
  server.tool(
    "update_route_destination",
    "Change the payout wallet on an existing payment route. Deposits after this point are paid out to the new address; use it when a customer rotates wallets rather than creating a second route.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The payment route (virtual account) ID"),
      destinationAddress: z.string().describe("New payout wallet address"),
      destinationPaymentRail: z
        .enum([
          "arbitrum",
          "avalanche_c_chain",
          "base",
          "celo",
          "ethereum",
          "optimism",
          "polygon",
          "solana",
          "stellar",
          "tron",
        ])
        .describe("Blockchain network the new address belongs to"),
      destinationCurrency: z
        .enum(["usdc", "usdt", "dai", "pyusd", "eurc"])
        .default("usdt")
        .describe("Stablecoin to receive"),
    },
    async ({
      customerId,
      virtualAccountId,
      destinationAddress,
      destinationPaymentRail,
      destinationCurrency,
    }) => {
      try {
        const account = await client.updateVirtualAccountDestination(customerId, virtualAccountId, {
          currency: destinationCurrency,
          payment_rail: destinationPaymentRail,
          address: destinationAddress,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Payout destination updated for route ${account.id}.

New destination: ${account.destination?.address ?? destinationAddress}
Network: ${account.destination?.payment_rail ?? destinationPaymentRail}
Currency: ${account.destination?.currency ?? destinationCurrency}

Future deposits pay out to this address.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update the payout destination: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
