/**
 * Developer fee: what the organisation charges its customers on top of Stables' fees on every
 * routing onramp and offramp, accrued to its developer fee balance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError, type DeveloperFee } from "../lib/stables-client.js";

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) return `${error.message} (HTTP ${error.statusCode})`;
  return error instanceof Error ? error.message : "Unknown error";
}

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], ...(isError && { isError }) };
}

function describeFee(fee: DeveloperFee): string {
  const parts = [
    fee.developer_fee_percent != null ? `${fee.developer_fee_percent}%` : null,
    fee.developer_fee_fixed_amount != null ? `${fee.developer_fee_fixed_amount} USD fixed` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `Developer fee: ${parts.join(" + ")} per routing onramp and offramp.`
    : "No developer fee is charged.";
}

/** A fee part: a decimal string (the API checks the format), or null to stop charging it. */
const feePart = (what: string) =>
  z
    .string()
    .nullable()
    .optional()
    .describe(
      `${what}, as a decimal string with at most 2 decimals, above 0 and at most 10. Omit to keep the current value; null to stop charging it.`
    );

export function registerDeveloperFeeTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "get_developer_fee",
    "Get your developer fee: what you charge your customers on top of Stables' fees on every routing onramp and offramp, as a percent, a fixed USD amount per transaction, or both.",
    {},
    async () => {
      try {
        return text(describeFee(await client.getDeveloperFee()));
      } catch (error) {
        return text(`Failed to get the developer fee: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "set_developer_fee",
    "Set or change your developer fee. Fields you omit keep their value; null stops charging that part, but at least one part must remain (use remove_developer_fee to stop it altogether). Applies to transactions quoted after the change.",
    {
      percent: feePart("Percent of every routing onramp and offramp"),
      fixedAmountUsd: feePart("Fixed USD amount per routing onramp and offramp"),
    },
    async ({ percent, fixedAmountUsd }) => {
      if (percent === undefined && fixedAmountUsd === undefined) {
        return text("Give percent, fixedAmountUsd, or both.", true);
      }
      try {
        const fee = await client.setDeveloperFee({
          ...(percent !== undefined ? { developer_fee_percent: percent } : {}),
          ...(fixedAmountUsd !== undefined ? { developer_fee_fixed_amount: fixedAmountUsd } : {}),
        });
        return text(`Updated. ${describeFee(fee)}`);
      } catch (error) {
        return text(`Failed to set the developer fee: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "remove_developer_fee",
    "Stop charging any developer fee on new routing transactions. Transactions already quoted keep their fees.",
    {},
    async () => {
      try {
        const fee = await client.removeDeveloperFee();
        return text(`Removed. ${describeFee(fee)}`);
      } catch (error) {
        return text(`Failed to remove the developer fee: ${formatError(error)}`, true);
      }
    }
  );
}
