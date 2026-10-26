/**
 * Saved Beneficiary Tools for Stables MCP Server
 *
 * Mirrors /api/v1/beneficiaries as of 2026-10-26. A beneficiary is a recipient
 * and bank account saved once; create_transfer then pays it by id with
 * destinationType "beneficiary" instead of repeating the bank details.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Beneficiary, StablesApiClient } from "../lib/stables-client.js";
import { bankDestinationShape, buildBankDestination } from "./transfers.js";

function nameOf(b: Beneficiary): string {
  return b.label ?? b.destination.account_holder_name;
}

function validationLine(b: Beneficiary): string {
  if (b.validation.valid) return "Passes today's payout rules";
  const errors = (b.validation.errors ?? [])
    .map((e) => `\n  - ${e.field ? `${e.field}: ` : ""}${e.message} (${e.code})`)
    .join("");
  return `Incomplete for today's payout rules; save it again with the missing fields:${errors}`;
}

function details(b: Beneficiary): string {
  const d = b.destination;
  const account = d.iban ?? d.account_number;
  return `Beneficiary ID: ${b.id}
Name: ${nameOf(b)}
Account holder: ${d.account_holder_name}${d.recipient_type ? ` (${d.recipient_type})` : ""}
Bank: ${d.bank_name}, ${d.bank_country}
${account ? `Account: ${account}\n` : ""}Currency: ${d.currency}
Network: ${b.network}
Status: ${b.status}
Last paid: ${b.last_used_at ?? "never"}
Validation: ${validationLine(b)}`;
}

function failure(action: string, error: unknown) {
  const apiError = error as { statusCode?: number; errorBody?: unknown };
  // Validation failures carry the offending fields in the body.
  const details = apiError.errorBody
    ? `\nAPI Response: ${JSON.stringify(apiError.errorBody, null, 2)}`
    : "";
  const status = apiError.statusCode ? ` (HTTP ${apiError.statusCode})` : "";
  return {
    content: [
      {
        type: "text" as const,
        text: `Failed to ${action}${status}: ${error instanceof Error ? error.message : "Unknown error"}${details}`,
      },
    ],
    isError: true,
  };
}

export function registerBeneficiaryTools(server: McpServer, client: StablesApiClient) {
  // List Beneficiaries
  server.tool(
    "list_beneficiaries",
    "List the organisation's saved beneficiaries, most recently paid first. Use it to find the beneficiaryId that create_transfer takes with destinationType 'beneficiary'.",
    {
      currency: z
        .string()
        .optional()
        .describe("Only beneficiaries paid in this currency (e.g. 'EUR')"),
      network: z
        .enum(["bank", "swift"])
        .optional()
        .describe("Only beneficiaries paid by this network"),
      status: z
        .enum(["active", "archived", "all"])
        .optional()
        .describe("Defaults to active. Archived beneficiaries cannot be paid"),
      search: z
        .string()
        .optional()
        .describe("Case-insensitive match on label, account holder or bank name"),
      pageSize: z.number().optional().describe("Beneficiaries per page (default 50, max 100)"),
      pageToken: z.string().optional().describe("Token for the next page of results"),
    },
    async (params) => {
      try {
        const response = await client.listBeneficiaries(params);
        if (response.beneficiaries.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No saved beneficiaries match. Use 'create_beneficiary' to save one.",
              },
            ],
          };
        }

        const list = response.beneficiaries
          .map((b) => {
            const flag = b.validation.valid ? "" : ", incomplete";
            return `- ${b.id}: ${nameOf(b)} - ${b.destination.currency} by ${b.network}, ${b.destination.bank_name} (${b.status}${flag})`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Beneficiaries (${response.beneficiaries.length} of ${response.page.total}):

${list}
${response.page.next_page_token ? `\nMore results available. Use pageToken: "${response.page.next_page_token}"` : ""}`,
            },
          ],
        };
      } catch (error) {
        return failure("list beneficiaries", error);
      }
    }
  );

  // Get Beneficiary
  server.tool(
    "get_beneficiary",
    "Get a saved beneficiary's recipient and bank details, and whether it still passes today's payout rules. Rules tighten over time, so an older beneficiary can need more fields before it can be paid.",
    {
      beneficiaryId: z.string().describe("The beneficiary ID to look up"),
    },
    async ({ beneficiaryId }) => {
      try {
        const beneficiary = await client.getBeneficiary(beneficiaryId);
        return { content: [{ type: "text" as const, text: details(beneficiary) }] };
      } catch (error) {
        return failure("get beneficiary", error);
      }
    }
  );

  // Create Beneficiary
  server.tool(
    "create_beneficiary",
    "Save a recipient and their bank account for a currency and network, so later transfers can pay it by id. The details are validated exactly as a transfer on that network would be. Saving an account that is already saved returns the existing beneficiary with its details refreshed, and revives it if archived.",
    {
      network: z
        .enum(["bank", "swift"])
        .describe(
          "Network the beneficiary is paid by: bank = local transfer, swift = international wire"
        ),
      label: z
        .string()
        .optional()
        .describe("Display name (e.g. 'Acme Supplies (EUR)'). Defaults to the account holder name"),
      ...bankDestinationShape,
    },
    async ({ network, label, ...input }) => {
      try {
        const beneficiary = await client.createBeneficiary({
          network,
          ...(label && { label }),
          destination: buildBankDestination(input),
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Beneficiary saved.

${details(beneficiary)}

Pay it with create_transfer, destinationType 'beneficiary' and this beneficiaryId.`,
            },
          ],
        };
      } catch (error) {
        return failure("save beneficiary", error);
      }
    }
  );

  // Archive Beneficiary
  server.tool(
    "archive_beneficiary",
    "Archive a saved beneficiary. It leaves active listings and is refused as a transfer destination; transfers already made to it are unaffected. Saving the same account again revives it.",
    {
      beneficiaryId: z.string().describe("The beneficiary ID to archive"),
    },
    async ({ beneficiaryId }) => {
      try {
        const beneficiary = await client.archiveBeneficiary(beneficiaryId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Beneficiary ${beneficiary.id} (${nameOf(beneficiary)}) is ${beneficiary.status}.`,
            },
          ],
        };
      } catch (error) {
        return failure("archive beneficiary", error);
      }
    }
  );
}
