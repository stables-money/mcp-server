/**
 * Virtual Account Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  CreateVirtualAccountRequest,
  CryptoDepositInstructions,
  VirtualAccount,
  VirtualAccountDepositInstructions,
} from "../lib/stables-client.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { PURPOSE_CODES, bankDestinationShape, buildBankDestination } from "./transfers.js";

const NETWORKS = [
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
] as const;

const PAYOUT_NETWORKS = [
  "swift",
  "bank",
  "payid",
  "mobile_money",
  "ach",
  "fedwire",
  "fps",
  "chaps",
  "sepa",
  "sepa_instant",
  "fast",
  "chats",
  "unionpay",
] as const;

function isCryptoInstructions(
  i: VirtualAccountDepositInstructions | CryptoDepositInstructions
): i is CryptoDepositInstructions {
  return (i as CryptoDepositInstructions).type === "crypto";
}

/** Deposit instructions for either kind of route: bank details, or an off-ramp route's address. */
function describeDepositInstructions(
  instructions: VirtualAccountDepositInstructions | CryptoDepositInstructions
): string {
  if (isCryptoInstructions(instructions)) {
    return `Send only ${instructions.currency.toUpperCase()} on ${instructions.network} to:
Address: ${instructions.wallet_address}`;
  }
  let info = `Currency: ${instructions.currency}`;
  info += `\nPayment Rails: ${instructions.payment_rails.join(", ")}`;
  if (instructions.bank_name) info += `\nBank: ${instructions.bank_name}`;
  if (instructions.bank_account_number)
    info += `\nAccount Number: ${instructions.bank_account_number}`;
  if (instructions.bank_routing_number)
    info += `\nRouting Number: ${instructions.bank_routing_number}`;
  if (instructions.iban) info += `\nIBAN: ${instructions.iban}`;
  if (instructions.bic) info += `\nBIC: ${instructions.bic}`;
  if (instructions.account_holder_name)
    info += `\nAccount Holder: ${instructions.account_holder_name}`;
  if (instructions.payment_rails.includes("swift"))
    info += `\nSWIFT collection account: held in a Stables entity's name, not the customer's. Give payers every field above exactly as shown.`;
  return info;
}

/** Where deposits are paid out: a wallet (on-ramp route) or a bank account (off-ramp route). */
function describePayout(account: VirtualAccount): string {
  if (account.destination) {
    return `Payout Address: ${account.destination.address}
Payment Rail: ${account.destination.payment_rail}
Currency: ${account.destination.currency}`;
  }
  const bank = account.fiat_destination;
  if (bank) {
    const acct = bank.account_number ?? bank.iban ?? bank.pay_id;
    return [
      bank.account_holder_name && `Account Holder: ${bank.account_holder_name}`,
      bank.bank_name && `Bank: ${bank.bank_name}`,
      acct && `Account: ${acct}`,
      bank.currency && `Currency: ${bank.currency}`,
      bank.bank_country && `Country: ${bank.bank_country}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "No payout destination configured";
}

function describeVirtualAccount(account: VirtualAccount): string {
  const balanceInfo = account.held_balance
    ? `\nHeld Balance: ${account.held_balance.amount} ${account.held_balance.currency}`
    : "";
  return `Account ID: ${account.id}
Status: ${account.status}
Customer ID: ${account.customer_id}${account.workflow_type ? `\nType: ${account.workflow_type}` : ""}
Deposit Mode: ${account.deposit_handling_mode}

Deposit Instructions:
${describeDepositInstructions(account.source_deposit_instructions)}

Payout Destination:
${describePayout(account)}
${balanceInfo}
Created: ${account.created_at}`;
}

export function registerVirtualAccountTools(server: McpServer, client: StablesApiClient) {
  // Create Virtual Account
  server.tool(
    "create_virtual_account",
    "Create a payment route for a customer. " +
      "fiat_to_crypto (the default) issues a virtual bank account: fiat deposits convert to a stablecoin and pay out to a wallet, so destinationAddress and destinationPaymentRail are required. " +
      "Set sourcePaymentRail to 'swift' for a SWIFT collection account: an IBAN that receives international SWIFT transfers, for business customers whose verification is approved and who hold the base_pay_in entitlement; it is not in the customer's name, and settles in USDT on Tron. " +
      "crypto_to_fiat (an off-ramp route) issues a permanent USDT or USDC deposit address on sourceNetwork: every deposit converts and pays out to one bank account, given as a saved beneficiary (payoutType beneficiary + beneficiaryId) or as bank details. " +
      "On a crypto_to_fiat route, swiftCode or bicCode is needed only when payoutNetwork is swift. Its deposits are route transactions, read with get_virtual_account_history, never transfers. " +
      "Deposit handling is set server-side and defaults to auto_payout; change it afterwards with update_virtual_account.",
    {
      customerId: z.string().describe("The customer ID to create the payment route for"),
      workflowType: z
        .enum(["fiat_to_crypto", "crypto_to_fiat"])
        .default("fiat_to_crypto")
        .describe(
          "fiat_to_crypto: a virtual bank account paying out to a wallet. crypto_to_fiat: a permanent stablecoin address paying out to a bank account"
        ),
      sourceCurrency: z
        .string()
        .describe(
          "What the customer deposits: a fiat currency for fiat_to_crypto (e.g. 'AUD', 'USD'), or 'USDT' / 'USDC' for crypto_to_fiat"
        ),
      sourcePaymentRail: z
        .enum(["swift"])
        .optional()
        .describe(
          "fiat_to_crypto only. Omit for the currency's local rail. 'swift' opens a SWIFT collection account (business customers with approved verification and base_pay_in). " +
            "SWIFT currencies: AED, AUD, CAD, CHF, CZK, DKK, EUR, GBP, GEL, HKD, HUF, JPY, NZD, PLN, SEK, SGD, THB, USD; payout USDT on tron"
        ),
      sourceNetwork: z
        .enum(NETWORKS)
        .optional()
        .describe("crypto_to_fiat only, required: the network the deposit address is issued on"),
      destinationAddress: z
        .string()
        .optional()
        .describe(
          "fiat_to_crypto only, required: wallet address deposits are paid out to. Validated against the chosen network"
        ),
      destinationPaymentRail: z
        .enum(NETWORKS)
        .optional()
        .describe(
          "fiat_to_crypto only, required: blockchain network the payout address belongs to"
        ),
      destinationCurrency: z
        .enum(["usdc", "usdt", "dai", "pyusd", "eurc"])
        .default("usdt")
        .describe("fiat_to_crypto only: stablecoin to receive"),
      payoutType: z
        .enum(["bank", "beneficiary"])
        .default("bank")
        .describe(
          "crypto_to_fiat only: pay out to bank details given here, or to a saved beneficiary"
        ),
      beneficiaryId: z
        .string()
        .optional()
        .describe(
          "crypto_to_fiat with payoutType beneficiary: a saved beneficiary id. Its bank details are copied onto the route; archived beneficiaries are refused"
        ),
      ...bankDestinationShape,
      payoutNetwork: z
        .enum(PAYOUT_NETWORKS)
        .optional()
        .describe(
          "crypto_to_fiat only: how each deposit is paid out. Defaults to the saved beneficiary's payment method, else bank (domestic). swift requires swiftCode or bicCode"
        ),
      purposeCode: z
        .enum(PURPOSE_CODES)
        .optional()
        .describe(
          "crypto_to_fiat only: the purpose every payout carries. Required where an off-ramp transfer to the same destination requires one"
        ),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe("Optional key-value data returned on the route"),
    },
    async (input) => {
      try {
        let request: CreateVirtualAccountRequest;

        if (input.workflowType === "crypto_to_fiat") {
          if (!input.sourceNetwork) {
            throw new Error("A crypto_to_fiat route needs sourceNetwork");
          }
          let fiatDestination: NonNullable<CreateVirtualAccountRequest["fiat_destination"]>;
          if (input.payoutType === "beneficiary") {
            if (!input.beneficiaryId) {
              throw new Error("payoutType beneficiary needs beneficiaryId");
            }
            fiatDestination = { type: "beneficiary", beneficiary_id: input.beneficiaryId };
          } else {
            if (!input.accountNumber && !input.iban) {
              throw new Error("Bank details need accountNumber or iban");
            }
            if (input.payoutNetwork === "swift" && !input.swiftCode && !input.bicCode) {
              throw new Error("A swift payout needs swiftCode or bicCode");
            }
            fiatDestination = buildBankDestination(input);
          }
          if (input.payoutNetwork) fiatDestination.network = input.payoutNetwork;

          request = {
            source: { currency: input.sourceCurrency.toUpperCase(), network: input.sourceNetwork },
            workflow_type: "crypto_to_fiat",
            fiat_destination: fiatDestination,
            ...(input.purposeCode && { purpose_code: input.purposeCode }),
            ...(input.metadata && { metadata: input.metadata }),
          };
        } else {
          if (!input.destinationAddress || !input.destinationPaymentRail) {
            throw new Error(
              "A fiat_to_crypto route needs destinationAddress and destinationPaymentRail"
            );
          }
          // deposit_handling_mode is deliberately absent: it is not part of the
          // create schema and was silently ignored here. The server sets it, and
          // update_virtual_account changes it.
          request = {
            source: {
              currency: input.sourceCurrency,
              ...(input.sourcePaymentRail ? { payment_rail: input.sourcePaymentRail } : {}),
            },
            workflow_type: "fiat_to_crypto",
            destination: {
              currency: input.destinationCurrency,
              payment_rail: input.destinationPaymentRail,
              address: input.destinationAddress,
            },
            ...(input.metadata && { metadata: input.metadata }),
          };
        }

        const account = await client.createVirtualAccount(input.customerId, request);

        return {
          content: [
            {
              type: "text",
              text: `Payment route created successfully!

${describeVirtualAccount(account)}

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

  // Get one Virtual Account
  server.tool(
    "get_virtual_account",
    "Get one payment route by ID, including its deposit instructions (bank details, or an off-ramp route's deposit address) and payout destination",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The payment route (virtual account) ID"),
    },
    async ({ customerId, virtualAccountId }) => {
      try {
        const account = await client.getVirtualAccount(customerId, virtualAccountId);
        return { content: [{ type: "text", text: describeVirtualAccount(account) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get virtual account: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    "List payment routes (virtual accounts) for one customer, or across every customer when customerId is omitted",
    {
      customerId: z
        .string()
        .optional()
        .describe("Only this customer's routes; omit to list routes across all customers"),
      status: z
        .enum(["activated", "deactivated", "pending", "closed"])
        .optional()
        .describe("Filter by account status"),
      limit: z.number().optional().describe("Maximum number of accounts to return"),
      startingAfter: z
        .string()
        .optional()
        .describe("Return routes after this route ID (the last ID of the previous page)"),
    },
    async ({ customerId, status, limit, startingAfter }) => {
      try {
        const response = customerId
          ? await client.listVirtualAccounts(customerId, { status, limit, startingAfter })
          : await client.listAllVirtualAccounts({ status, limit, startingAfter });
        const scope = customerId ? `customer ${customerId}` : "any customer";

        if (response.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No virtual accounts found for ${scope}. Use 'create_virtual_account' to create one.`,
              },
            ],
          };
        }

        const accountList = response.data
          .map((a) => {
            const dest = a.destination
              ? `Payout: ${a.destination.address.slice(0, 10)}... (${a.destination.payment_rail})`
              : a.fiat_destination
                ? `Payout: bank account in ${a.fiat_destination.currency ?? "fiat"}`
                : "No payout destination";
            const source = isCryptoInstructions(a.source_deposit_instructions)
              ? `${a.source_deposit_instructions.currency.toUpperCase()} on ${a.source_deposit_instructions.network}`
              : a.source_deposit_instructions.currency;
            const balance = a.held_balance
              ? ` | Balance: ${a.held_balance.amount} ${a.held_balance.currency}`
              : "";
            return `- ${a.id}: ${source} (${a.status}) - ${dest}${balance}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Virtual Accounts for ${scope} (${response.count} total):

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

  // AUD payment route whitelisting
  const whitelistIds = {
    customerId: z.string().describe("The customer ID"),
    virtualAccountId: z.string().describe("The AUD payment route (virtual account) ID"),
  };

  server.tool(
    "list_route_whitelist",
    "List the bank accounts whitelisted to pay into an AUD payment route. Some Australian routes only accept deposits from whitelisted source accounts.",
    whitelistIds,
    async ({ customerId, virtualAccountId }) => {
      try {
        const result = await client.listRouteWhitelist(customerId, virtualAccountId);
        if (result.data.length === 0) {
          return {
            content: [{ type: "text", text: "No whitelisted source accounts on this route." }],
          };
        }
        const lines = result.data
          .map(
            (a) =>
              `- #${a.id}: BSB ${a.bsb_number} account ${a.account_number}${a.account_name ? ` (${a.account_name})` : ""} - ${a.account_status}`
          )
          .join("\n");
        return {
          content: [
            { type: "text", text: `Whitelisted source accounts (${result.count}):\n${lines}` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list whitelist: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "add_route_whitelist_account",
    "Whitelist an Australian bank account (BSB and account number) to pay into an AUD payment route.",
    {
      ...whitelistIds,
      bsbNumber: z.string().describe("Source account BSB"),
      accountNumber: z.string().describe("Source account number"),
      enabled: z.boolean().default(true).describe("Whether deposits from it are accepted now"),
    },
    async ({ customerId, virtualAccountId, bsbNumber, accountNumber, enabled }) => {
      try {
        const account = await client.addRouteWhitelistAccount(customerId, virtualAccountId, {
          bsb_number: bsbNumber,
          account_number: accountNumber,
          account_status: enabled ? "enabled" : "disabled",
        });
        return {
          content: [
            {
              type: "text",
              text: `Whitelisted #${account.id}: BSB ${account.bsb_number} account ${account.account_number} (${account.account_status})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to whitelist account: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_route_whitelist_account",
    "Change or disable a whitelisted source account on an AUD payment route. Send the full record: BSB, account number and status.",
    {
      ...whitelistIds,
      sourceAccountId: z
        .number()
        .int()
        .positive()
        .describe("The whitelist entry ID (from list_route_whitelist)"),
      bsbNumber: z.string().describe("Source account BSB"),
      accountNumber: z.string().describe("Source account number"),
      enabled: z.boolean().describe("false to stop accepting deposits from it"),
    },
    async ({
      customerId,
      virtualAccountId,
      sourceAccountId,
      bsbNumber,
      accountNumber,
      enabled,
    }) => {
      try {
        const account = await client.updateRouteWhitelistAccount(
          customerId,
          virtualAccountId,
          sourceAccountId,
          {
            bsb_number: bsbNumber,
            account_number: accountNumber,
            account_status: enabled ? "enabled" : "disabled",
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Updated #${account.id}: BSB ${account.bsb_number} account ${account.account_number} (${account.account_status})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update whitelist entry: ${error instanceof Error ? error.message : "Unknown error"}`,
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

  server.tool(
    "register_route_payid",
    "Register a PayID for an activated AUD payment route, so payers can send to an email-style alias instead of a BSB and account number. Calling it again on a route that already has one returns the existing PayID.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The AUD payment route (virtual account) ID"),
    },
    async ({ customerId, virtualAccountId }) => {
      try {
        const payId = await client.registerPayId(customerId, virtualAccountId);
        const state = payId.already_registered ? "already registered" : "registered";
        const status = payId.pay_id_status ?? payId.status;
        return {
          content: [
            {
              type: "text" as const,
              text:
                `PayID ${state} on route ${virtualAccountId}: ${payId.pay_id}` +
                (payId.pay_id_name ? ` (${payId.pay_id_name})` : "") +
                (status ? `, status ${status}` : "") +
                (payId.status_description ? `. ${payId.status_description}` : ""),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to register PayID: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
