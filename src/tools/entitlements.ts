/**
 * Entitlement Tools for Stables MCP Server
 *
 * Mirrors the Entitlements guide on docs.stables.money: check what a customer
 * can apply for, request it, submit any further verification Stables asks for,
 * then wait for the phase to reach `ready` (get_customer shows it) before
 * creating payment routes on it.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  StablesApiClient,
  StablesApiError,
  EntitlementsResponse,
  ENTITLEMENT_IDS,
} from "../lib/stables-client.js";

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) return `${error.message} (HTTP ${error.statusCode})`;
  return error instanceof Error ? error.message : "Unknown error";
}

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], ...(isError && { isError }) };
}

function describeEntitlements(result: EntitlementsResponse): string {
  return result.entitlements
    .map((e) => {
      const missing = e.requirements?.missing?.length
        ? `, missing: ${e.requirements.missing.join(", ")}`
        : "";
      return `- ${e.name}: ${e.status}${e.phase ? ` (phase ${e.phase})` : ""}${missing}`;
    })
    .join("\n");
}

export function registerEntitlementTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "list_available_entitlements",
    "List the entitlements (products and payment rails, e.g. 'aed_local') a customer has not applied for yet, whether each is available to them now, and the verification it needs.",
    {
      customerId: z.string().describe("The customer ID"),
    },
    async ({ customerId }) => {
      try {
        const result = (await client.listAvailableEntitlements(customerId)) as {
          entitlements?: {
            name: string;
            eligible?: boolean;
            required_verification_levels?: unknown[];
          }[];
        };
        const list = result.entitlements ?? [];
        if (list.length === 0)
          return text(`Customer ${customerId} has applied for every entitlement.`);
        const lines = list.map(
          (e) =>
            `- ${e.name}: ${e.eligible ? "can request now" : "not available yet"}` +
            (e.required_verification_levels?.length
              ? `, needs ${e.required_verification_levels
                  .map((l) =>
                    typeof l === "string" ? l : ((l as { name?: string }).name ?? JSON.stringify(l))
                  )
                  .join(", ")}`
              : "")
        );
        return text(`Entitlements available to ${customerId}:\n${lines.join("\n")}`);
      } catch (error) {
        return text(`Failed to list entitlements: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "request_entitlements",
    "Apply for one or more entitlements for an existing customer, e.g. to add a payment rail. Check list_available_entitlements first. If Stables needs more verification, the response lists what is missing; send it with submit_entitlement_requirements.",
    {
      customerId: z.string().describe("The customer ID"),
      entitlements: z
        .array(z.enum(ENTITLEMENT_IDS))
        .min(1)
        .describe("Entitlement names, e.g. ['aed_local']"),
    },
    async ({ customerId, entitlements }) => {
      try {
        const result = await client.requestEntitlements(customerId, entitlements);
        return text(`Entitlements requested for ${customerId}:\n${describeEntitlements(result)}

Create payment routes on an entitlement only once its phase is 'ready' (check with get_customer).`);
      } catch (error) {
        return text(`Failed to request entitlements: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "submit_entitlement_requirements",
    "Send further verification data Stables asked for on a requested entitlement. The fields are those of the customer record in snake_case (e.g. tax_id_number, address, financial_profile, id_documents, proof_of_address_documents); send only what is missing. Documents are base64 data.",
    {
      customerId: z.string().describe("The customer ID"),
      entitlement: z.string().describe("The entitlement name, e.g. 'aed_local'"),
      requirements: z
        .record(z.string(), z.unknown())
        .describe("The missing fields, snake_case as in the Update Customer reference"),
    },
    async ({ customerId, entitlement, requirements }) => {
      try {
        const result = await client.updateEntitlementRequirements(
          customerId,
          entitlement,
          requirements
        );
        return text(`Requirements submitted for ${entitlement}:\n${describeEntitlements(result)}`);
      } catch (error) {
        return text(`Failed to submit requirements: ${formatError(error)}`, true);
      }
    }
  );
}
