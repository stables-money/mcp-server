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
    "Create a virtual bank account for a customer to receive fiat deposits. Deposits convert to the specified stablecoin and payout to the provided wallet. Deposit-handling mode is set server-side and can later be changed via update_virtual_account.",
    {
      customerId: z.string().describe("The customer ID to create the virtual account for"),
      sourceCurrency: z.string().describe("Currency for the virtual account (e.g., 'USD', 'EUR', 'GBP', 'AUD')"),
      destinationAddress: z.string().describe("Crypto wallet address for payouts"),
      destinationPaymentRail: z.enum(["arbitrum", "avalanche_c_chain", "base", "celo", "ethereum", "optimism", "polygon", "solana", "stellar", "tron"])
        .describe("Blockchain network for the destination wallet"),
      destinationCurrency: z.enum(["usdc", "usdt", "dai", "pyusd", "eurc"]).optional()
        .describe("Stablecoin to receive (default: usdc)"),
      destinationMemo: z.string().optional().describe("Memo/tag for the destination (required on some chains like Stellar)"),
      developerFeePercent: z.string().optional().describe("Developer fee percent as decimal string (e.g. '0.5')"),
    },
    async ({ customerId, sourceCurrency, destinationAddress, destinationPaymentRail, destinationCurrency, destinationMemo, developerFeePercent }) => {
      try {
        const request = {
          source: { currency: sourceCurrency },
          destination: {
            currency: destinationCurrency || "usdc",
            payment_rail: destinationPaymentRail,
            address: destinationAddress,
            ...(destinationMemo ? { memo: destinationMemo } : {}),
          },
          ...(developerFeePercent ? { developer_fee_percent: developerFeePercent } : {}),
        } as const;

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
    async ({ customerId, virtualAccountId, limit, eventType: _eventType }) => {
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

  // Set / Replace Virtual Account Destination
  server.tool(
    "set_virtual_account_destination",
    "Create or replace the active payout destination (crypto wallet) for a virtual account. Use this to change where deposits auto-payout to without re-creating the account.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The virtual account ID"),
      address: z.string().describe("Crypto wallet address for payouts"),
      paymentRail: z.enum(["arbitrum", "avalanche_c_chain", "base", "celo", "ethereum", "optimism", "polygon", "solana", "stellar", "tron"])
        .describe("Blockchain network for the destination wallet"),
      currency: z.enum(["usdc", "usdt", "dai", "pyusd", "eurc"]).describe("Stablecoin to receive"),
      memo: z.string().optional().describe("Memo/tag for the destination (required on some chains like Stellar)"),
    },
    async ({ customerId, virtualAccountId, address, paymentRail, currency, memo }) => {
      try {
        const account = await client.setVirtualAccountDestination(customerId, virtualAccountId, {
          currency,
          payment_rail: paymentRail,
          address,
          ...(memo ? { memo } : {}),
        });
        const dest = account.destination;
        return {
          content: [
            {
              type: "text",
              text: `Destination updated for virtual account ${account.id}.
Address: ${dest?.address}
Payment Rail: ${dest?.payment_rail}
Currency: ${dest?.currency}${dest?.memo ? `\nMemo: ${dest.memo}` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to set destination: ${error instanceof Error ? error.message : "Unknown error"}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Register PayID (AUD virtual accounts)
  server.tool(
    "register_payid",
    "Register a PayID for an activated AUD virtual account. If pay_id is omitted, the provider assigns one.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The AUD virtual account ID"),
      payId: z.string().max(256).optional().describe("Optional PayID string; omit to let provider auto-assign"),
    },
    async ({ customerId, virtualAccountId, payId }) => {
      try {
        const res = await client.registerPayId(
          customerId,
          virtualAccountId,
          payId ? { pay_id: payId } : undefined
        );
        const lines = [
          `PayID: ${res.pay_id}`,
          res.already_registered !== undefined ? `Already registered: ${res.already_registered}` : null,
          res.status ? `Status: ${res.status}` : null,
          res.status_description ? `Status detail: ${res.status_description}` : null,
          res.pay_id_name ? `PayID name: ${res.pay_id_name}` : null,
          res.pay_id_status ? `PayID status: ${res.pay_id_status}` : null,
        ].filter(Boolean);
        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to register PayID: ${error instanceof Error ? error.message : "Unknown error"}` },
          ],
          isError: true,
        };
      }
    }
  );

  // List whitelisted source accounts (AUD)
  server.tool(
    "list_whitelist_accounts",
    "List whitelisted source accounts for an AUD virtual account. Only deposits from whitelisted BSB/account pairs will be accepted.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The AUD virtual account ID"),
    },
    async ({ customerId, virtualAccountId }) => {
      try {
        const res = await client.listWhitelistAccounts(customerId, virtualAccountId);
        if (res.data.length === 0) {
          return { content: [{ type: "text", text: `No whitelisted source accounts found.` }] };
        }
        const list = res.data
          .map((a) => `- id=${a.id} ${a.account_name || "(no name)"} BSB ${a.bsb_number} Acct ${a.account_number} [${a.account_status}]`)
          .join("\n");
        return {
          content: [{ type: "text", text: `Whitelisted source accounts (${res.count}):\n${list}` }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to list whitelist: ${error instanceof Error ? error.message : "Unknown error"}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Create whitelisted source account (AUD)
  server.tool(
    "create_whitelist_account",
    "Add a whitelisted source bank account (BSB + account number) to an AUD virtual account.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The AUD virtual account ID"),
      accountNumber: z.string().min(1).describe("Source bank account number"),
      bsbNumber: z.string().min(1).describe("Source bank BSB number"),
      accountName: z.string().optional().describe("Optional account holder name"),
      accountStatus: z.enum(["enabled", "disabled"]).optional().describe("Initial status (default: enabled)"),
    },
    async ({ customerId, virtualAccountId, accountNumber, bsbNumber, accountName, accountStatus }) => {
      try {
        const res = await client.createWhitelistAccount(customerId, virtualAccountId, {
          source_account: {
            account_number: accountNumber,
            bsb_number: bsbNumber,
            ...(accountName ? { account_name: accountName } : {}),
            ...(accountStatus ? { account_status: accountStatus } : {}),
          },
        });
        return {
          content: [
            {
              type: "text",
              text: `Whitelisted source account created. id=${res.id} BSB ${res.bsb_number} Acct ${res.account_number} [${res.account_status}]`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to create whitelist entry: ${error instanceof Error ? error.message : "Unknown error"}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Update whitelisted source account (AUD)
  server.tool(
    "update_whitelist_account",
    "Update a whitelisted source account on an AUD virtual account (change BSB/account number, name, or enabled/disabled status).",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The AUD virtual account ID"),
      sourceAccountId: z.union([z.number(), z.string()]).describe("The whitelist entry ID"),
      accountNumber: z.string().min(1).describe("Source bank account number"),
      bsbNumber: z.string().min(1).describe("Source bank BSB number"),
      accountStatus: z.enum(["enabled", "disabled"]).describe("Enabled or disabled"),
      accountName: z.string().optional().describe("Optional account holder name"),
    },
    async ({ customerId, virtualAccountId, sourceAccountId, accountNumber, bsbNumber, accountStatus, accountName }) => {
      try {
        const res = await client.updateWhitelistAccount(customerId, virtualAccountId, sourceAccountId, {
          account_number: accountNumber,
          bsb_number: bsbNumber,
          account_status: accountStatus,
          ...(accountName !== undefined ? { account_name: accountName } : {}),
        });
        return {
          content: [
            {
              type: "text",
              text: `Whitelist entry ${res.id} updated. BSB ${res.bsb_number} Acct ${res.account_number} [${res.account_status}]`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to update whitelist entry: ${error instanceof Error ? error.message : "Unknown error"}` },
          ],
          isError: true,
        };
      }
    }
  );
}
