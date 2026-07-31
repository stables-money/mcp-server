/**
 * Payment method validation for the Stables MCP Server.
 *
 * Mirrors POST /api/v1/payment-methods/validate. The endpoint always answers
 * 200 and reports the outcome in the body, so this is the cheap way to discover
 * what a corridor requires — particularly the enhanced beneficiary fields on
 * AED, CAD, EUR, GBP, MXN and USD — before committing a short-lived quote.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, BankTransferDestination } from "../lib/stables-client.js";

export function registerPaymentMethodTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "validate_payment_method",
    "Check bank payout details against the destination currency's rules without creating a quote or transfer. " +
      "Use this before create_transfer: it reports exactly which fields are missing or wrong, including the " +
      "recipient type, date of birth and beneficiary address required for AED, CAD, EUR, GBP, MXN and USD.",
    {
      network: z
        .enum(["bank", "swift", "payid"])
        .describe("Payout network to validate against: local rails ('bank'), 'swift', or 'payid'"),
      accountHolderName: z
        .string()
        .describe("Account holder's full name, or the company name for a business beneficiary"),
      bankName: z.string().describe("Name of the destination bank"),
      bankCountry: z.string().describe("Bank country, ISO 2-letter"),
      currency: z.string().describe("Payout currency, ISO 3-letter"),
      recipientType: z.enum(["individual", "business"]).optional().describe("Beneficiary type"),
      dateOfBirth: z.string().optional().describe("Beneficiary date of birth, YYYY-MM-DD"),
      addressStreet: z.string().optional().describe("Beneficiary street address"),
      addressCity: z.string().optional().describe("Beneficiary city"),
      addressState: z.string().optional().describe("Beneficiary state or region"),
      addressPostalCode: z.string().optional().describe("Beneficiary postal code"),
      addressCountry: z.string().optional().describe("Beneficiary country, ISO 2-letter"),
      iban: z.string().optional().describe("IBAN"),
      accountNumber: z.string().optional().describe("Bank account number"),
      accountType: z.enum(["savings", "checking", "payment"]).optional().describe("Account type"),
      swiftCode: z.string().optional().describe("SWIFT code"),
      bicCode: z.string().optional().describe("BIC"),
      routingNumber: z.string().optional().describe("ABA routing number (US)"),
      sortCode: z.string().optional().describe("Sort code (UK)"),
      ifscCode: z.string().optional().describe("IFSC code (India)"),
      bsbCode: z.string().optional().describe("BSB code (Australia)"),
      bankCode: z.string().optional().describe("Bank code / institution number (CAD)"),
      branchCode: z.string().optional().describe("Branch code / transit number (CAD)"),
      cnaps: z.string().optional().describe("CNAPS (China)"),
    },
    async (input) => {
      try {
        const hasAddress = Boolean(
          input.addressStreet &&
          input.addressCity &&
          input.addressState &&
          input.addressPostalCode &&
          input.addressCountry
        );

        const destination: BankTransferDestination = {
          type: "bank",
          account_holder_name: input.accountHolderName,
          bank_name: input.bankName,
          bank_country: input.bankCountry,
          currency: input.currency,
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

        const result = await client.validatePaymentMethod(input.network, destination);

        if (result.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `These payout details are valid for ${input.currency} over ${input.network}. Safe to use with create_transfer.`,
              },
            ],
          };
        }

        const problems = (result.errors ?? [])
          .map((e) => `- ${e.field ? `${e.field}: ` : ""}${e.message} (${e.code})`)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `These payout details are NOT valid for ${input.currency} over ${input.network}:

${problems || "- No detail returned."}

Collect the missing information before calling create_transfer.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to validate payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
