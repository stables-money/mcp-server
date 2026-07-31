/**
 * Transfer Tools for Stables MCP Server
 *
 * Mirrors POST /api/v1/transfer as of 2026-07-30. The wire is snake_case and the
 * payout target is a discriminated `destination`, not the old nested
 * `paymentMethod.bankTransfer`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, TransferDestination, TransferStatus } from "../lib/stables-client.js";

/**
 * Currencies whose payouts require a fuller beneficiary record. Named in the
 * tool description so the model collects them up front rather than after a
 * rejection — and because two of the three fail late, as a stuck transfer
 * rather than a clean 400.
 */
const ENHANCED_BENEFICIARY_CURRENCIES = "AED, CAD, EUR, GBP, MXN, USD";

const STATUS_EXPLANATIONS: Partial<Record<TransferStatus, string>> = {
  created: "Transfer has been created and is awaiting processing.",
  compliance_hold: "Transfer is on hold pending compliance review.",
  awaiting_funds_collection: "Waiting for the customer to send crypto funds.",
  funds_collected: "Crypto funds have been received, payout is being prepared.",
  in_progress: "Transfer is being processed.",
  payment_submitted: "Bank payment has been submitted for processing.",
  payment_processed: "Bank payment has been processed successfully.",
  completed: "Transfer completed successfully!",
  failed: "Transfer failed. Check with support for details.",
  cancelled: "Transfer was cancelled.",
  expired: "Transfer expired before completion.",
  unknown: "Transfer state could not be determined.",
};

function describeType(type: string): string {
  return type === "onramp" ? "On-ramp (Fiat to Crypto)" : "Off-ramp (Crypto to Fiat)";
}

function depositBlock(transfer: { source_deposit_instructions?: Record<string, unknown> }): string {
  const deposit = transfer.source_deposit_instructions;
  const wallet = deposit?.["wallet_address"];
  if (!wallet) return "";
  return `
Deposit Instructions (share with customer):
  Wallet Address: ${String(wallet)}
  Currency: ${String(deposit?.["currency"] ?? "-")}
  Network: ${String(deposit?.["network"] ?? "-")}
  Amount: ${String(deposit?.["amount"] ?? "-")}

The customer must send this amount to that address. Once received, Stables processes the payout.`;
}

export function registerTransferTools(server: McpServer, client: StablesApiClient) {
  // Create Transfer
  server.tool(
    "create_transfer",
    "Execute a transfer using an active quote. The quote must not be expired. This initiates real money movement, so get explicit human approval first. " +
      `For payouts in ${ENHANCED_BENEFICIARY_CURRENCIES} you must also supply recipientType, the full beneficiary address, and dateOfBirth when the recipient is an individual. ` +
      "Use validate_payment_method first to check the details without spending the quote.",
    {
      customerId: z.string().describe("The customer ID for this transfer"),
      quoteId: z.string().describe("The quote ID to execute"),
      destinationType: z
        .enum(["bank", "crypto"])
        .default("bank")
        .describe("Payout target: a bank account (off-ramp) or a wallet address"),

      accountHolderName: z
        .string()
        .optional()
        .describe("Account holder's full name, or the company name when recipientType is business"),
      bankName: z.string().optional().describe("Name of the destination bank"),
      bankCountry: z.string().optional().describe("Bank country, ISO 2-letter (e.g. 'AU', 'US')"),
      bankCurrency: z.string().optional().describe("Payout currency, ISO 3-letter (e.g. 'EUR')"),
      recipientType: z
        .enum(["individual", "business"])
        .optional()
        .describe(`Beneficiary type. Required for ${ENHANCED_BENEFICIARY_CURRENCIES}`),
      dateOfBirth: z
        .string()
        .optional()
        .describe(
          `Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for ${ENHANCED_BENEFICIARY_CURRENCIES}`
        ),
      addressStreet: z.string().optional().describe("Beneficiary street address"),
      addressCity: z.string().optional().describe("Beneficiary city"),
      addressState: z.string().optional().describe("Beneficiary state or region"),
      addressPostalCode: z.string().optional().describe("Beneficiary postal code"),
      addressCountry: z
        .string()
        .optional()
        .describe(
          `Beneficiary country, ISO 2-letter. The complete address is required for ${ENHANCED_BENEFICIARY_CURRENCIES}`
        ),
      iban: z.string().optional().describe("IBAN (EU/international)"),
      accountNumber: z.string().optional().describe("Bank account number, if not using IBAN"),
      accountType: z
        .enum(["savings", "checking", "payment"])
        .optional()
        .describe("Account type. Required for CAD and USD bank payouts"),
      payId: z.string().optional().describe("PayID alias (AUD only). Requires payIdType"),
      payIdType: z
        .enum(["email", "phone", "abn", "org_id"])
        .optional()
        .describe("PayID alias type. Required when payId is given"),
      swiftCode: z.string().optional().describe("SWIFT code"),
      bicCode: z.string().optional().describe("BIC (EUR/GBP international)"),
      routingNumber: z.string().optional().describe("ABA routing number (US)"),
      sortCode: z.string().optional().describe("Sort code (UK)"),
      ifscCode: z.string().optional().describe("IFSC code (India)"),
      bsbCode: z.string().optional().describe("BSB code (Australia)"),
      bankCode: z.string().optional().describe("Bank code / institution number (CAD)"),
      branchCode: z.string().optional().describe("Branch code / transit number (CAD)"),
      cnaps: z.string().optional().describe("CNAPS (China)"),

      destinationCurrency: z
        .string()
        .optional()
        .describe("Stablecoin to deliver when destinationType is crypto (e.g. 'USDT')"),
      destinationNetwork: z
        .string()
        .optional()
        .describe("Blockchain network when destinationType is crypto (e.g. 'polygon')"),
      destinationAddress: z
        .string()
        .optional()
        .describe("Wallet address when destinationType is crypto"),

      purposeCode: z
        .string()
        .optional()
        .describe("Purpose of the transfer (e.g. 'SALARY'). Required on some corridors"),
      metadata: z.record(z.string()).optional().describe("Optional metadata"),
    },
    async (input) => {
      try {
        let destination: TransferDestination;

        if (input.destinationType === "crypto") {
          if (
            !input.destinationCurrency ||
            !input.destinationNetwork ||
            !input.destinationAddress
          ) {
            throw new Error(
              "A crypto destination needs destinationCurrency, destinationNetwork and destinationAddress"
            );
          }
          destination = {
            type: "crypto",
            currency: input.destinationCurrency,
            network: input.destinationNetwork,
            address: input.destinationAddress,
          };
        } else {
          if (
            !input.accountHolderName ||
            !input.bankName ||
            !input.bankCountry ||
            !input.bankCurrency
          ) {
            throw new Error(
              "A bank destination needs accountHolderName, bankName, bankCountry and bankCurrency"
            );
          }
          // Sent only when complete. Each sub-field is validated separately, so
          // half an address is rejected the same as none but is harder to debug.
          const hasAddress = Boolean(
            input.addressStreet &&
            input.addressCity &&
            input.addressState &&
            input.addressPostalCode &&
            input.addressCountry
          );

          destination = {
            type: "bank",
            account_holder_name: input.accountHolderName,
            bank_name: input.bankName,
            bank_country: input.bankCountry,
            currency: input.bankCurrency,
            ...(input.recipientType && { recipient_type: input.recipientType }),
            ...(input.dateOfBirth && { date_of_birth: input.dateOfBirth }),
            ...(hasAddress && {
              address: {
                street: input.addressStreet as string,
                city: input.addressCity as string,
                state: input.addressState as string,
                postal_code: input.addressPostalCode as string,
                country: input.addressCountry as string,
              },
            }),
            ...(input.iban && { iban: input.iban }),
            ...(input.accountNumber && { account_number: input.accountNumber }),
            ...(input.accountType && { account_type: input.accountType }),
            ...(input.payId && { pay_id: input.payId }),
            ...(input.payIdType && { pay_id_type: input.payIdType }),
            ...(input.swiftCode && { swift_code: input.swiftCode }),
            ...(input.bicCode && { bic_code: input.bicCode }),
            ...(input.routingNumber && { aba_code: input.routingNumber }),
            ...(input.sortCode && { sort_code: input.sortCode }),
            ...(input.ifscCode && { ifsc_code: input.ifscCode }),
            ...(input.bsbCode && { bsb_code: input.bsbCode }),
            ...(input.bankCode && { bank_code: input.bankCode }),
            ...(input.branchCode && { branch_code: input.branchCode }),
            ...(input.cnaps && { cnaps: input.cnaps }),
          };
        }

        const transfer = await client.createTransfer({
          customer_id: input.customerId,
          quote_id: input.quoteId,
          destination,
          ...(input.purposeCode && { purpose_code: input.purposeCode }),
          ...(input.metadata && { metadata: input.metadata }),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfer created successfully!

Transfer ID: ${transfer.id}
Type: ${describeType(transfer.type)}
Status: ${transfer.status}
Customer ID: ${transfer.customer_id}
Quote ID: ${transfer.quote_id}

Created: ${transfer.created_at}
${depositBlock(transfer)}

Use 'get_transfer' to check the status.`,
            },
          ],
        };
      } catch (error: unknown) {
        const apiError = error as { message?: string; statusCode?: number; errorBody?: unknown };
        // The API returns a `fields` array on beneficiary validation failures;
        // dumping the body keeps that detail instead of flattening it away.
        const details = apiError.errorBody
          ? `\nAPI Response: ${JSON.stringify(apiError.errorBody, null, 2)}`
          : "";
        const status = apiError.statusCode ? ` (HTTP ${apiError.statusCode})` : "";
        return {
          content: [
            {
              type: "text" as const,
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
        const statusInfo = STATUS_EXPLANATIONS[transfer.status] ?? "";

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfer Details:

Transfer ID: ${transfer.id}
Type: ${describeType(transfer.type)}
Status: ${transfer.status}
Customer ID: ${transfer.customer_id}
Quote ID: ${transfer.quote_id}

Created: ${transfer.created_at}
Updated: ${transfer.updated_at}
${depositBlock(transfer)}

${statusInfo}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
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
      status: z
        .enum([
          "created",
          "compliance_hold",
          "awaiting_funds_collection",
          "funds_collected",
          "in_progress",
          "payment_submitted",
          "payment_processed",
          "completed",
          "failed",
          "cancelled",
          "expired",
        ])
        .optional()
        .describe("Filter by transfer status"),
      type: z.enum(["onramp", "offramp"]).optional().describe("Filter by transfer type"),
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
                type: "text" as const,
                text: "No transfers found matching your criteria.",
              },
            ],
          };
        }

        const transferList = response.transfers
          .map((t) => {
            const typeShort = t.type === "onramp" ? "On-ramp" : "Off-ramp";
            return `- ${t.id}: ${typeShort} - ${t.status} (Customer: ${t.customer_id})`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfers (${response.transfers.length} of ${response.page.total}):

${transferList}
${response.page.next_page_token ? `\nMore results available. Use pageToken: "${response.page.next_page_token}"` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list transfers: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
