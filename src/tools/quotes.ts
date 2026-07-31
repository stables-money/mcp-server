/**
 * Quote Tools for Stables MCP Server
 *
 * Mirrors POST /api/v1/quotes and GET /api/v1/quotes/:id as of 2026-07-30. The
 * request takes `source`/`destination` (was `from`/`to`), the response is the
 * quote itself with no `{ quote }` wrapper, and `paymentMethodType` is gone —
 * the payment network is now `destination.network`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, Quote } from "../lib/stables-client.js";

const LIVE_NETWORKS = [
  "arbitrum",
  "avalanche",
  "base",
  "ethereum",
  "optimism",
  "polygon",
  "solana",
  "tron",
] as const;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function describeAmount(side: { amount: string; currency: string; network?: string }): string {
  return `${side.amount} ${side.currency}${side.network ? ` (${side.network})` : ""}`;
}

function feeLines(quote: Quote): string {
  const fees = quote.fees;
  let out = `Total Fees: ${fees.total_fee.amount} ${fees.total_fee.currency}`;
  if (fees.fx_fee) out += `\n  FX Fee: ${fees.fx_fee.amount} ${fees.fx_fee.currency}`;
  if (fees.platform_fee)
    out += `\n  Platform Fee: ${fees.platform_fee.amount} ${fees.platform_fee.currency}`;
  if (fees.payment_method_fee)
    out += `\n  Payment Method Fee: ${fees.payment_method_fee.amount} ${fees.payment_method_fee.currency}`;
  if (fees.network_fee)
    out += `\n  Network Fee: ${fees.network_fee.amount} ${fees.network_fee.currency}`;
  if (fees.integrator_fee)
    out += `\n  Integrator Fee: ${fees.integrator_fee.amount} ${fees.integrator_fee.currency}`;
  return out;
}

export function registerQuoteTools(server: McpServer, client: StablesApiClient) {
  // Create Quote
  server.tool(
    "create_quote",
    "Get a quote for a currency exchange: the rate, the fees, and what the customer receives. Quotes are short-lived, so create one immediately before the transfer. " +
      "Off-ramp converts a stablecoin to fiat (source network required, destination country required); on-ramp converts fiat to a stablecoin (destination address required). " +
      "Set preview to price without committing.",
    {
      sourceCurrency: z
        .string()
        .describe("Source currency: a stablecoin for off-ramp (e.g. 'USDT'), fiat for on-ramp"),
      sourceAmount: z.string().describe("Amount to convert, in major units (e.g. '125.75')"),
      sourceNetwork: z
        .enum(LIVE_NETWORKS)
        .optional()
        .describe("Blockchain network of the source. Required for off-ramp, omitted for on-ramp"),
      destinationCurrency: z
        .string()
        .describe("Destination currency: fiat for off-ramp (e.g. 'EUR'), a stablecoin for on-ramp"),
      destinationCountry: z
        .string()
        .optional()
        .describe("Destination country, ISO 2-letter. Required for off-ramp"),
      destinationNetwork: z
        .string()
        .optional()
        .describe(
          "Off-ramp: payment network, 'swift' or 'bank'. On-ramp: blockchain network. Replaces the old paymentMethodType"
        ),
      destinationAddress: z
        .string()
        .optional()
        .describe("Destination wallet address. Required for on-ramp"),
      preview: z
        .boolean()
        .optional()
        .describe("Price the quote without persisting it — use to show an estimate"),
      metadata: z.record(z.string()).optional().describe("Optional metadata"),
    },
    async (input) => {
      try {
        const quote = await client.createQuote({
          source: {
            currency: input.sourceCurrency,
            amount: input.sourceAmount,
            ...(input.sourceNetwork && { network: input.sourceNetwork }),
          },
          destination: {
            currency: input.destinationCurrency,
            ...(input.destinationCountry && { country: input.destinationCountry }),
            ...(input.destinationNetwork && { network: input.destinationNetwork }),
            ...(input.destinationAddress && { address: input.destinationAddress }),
          },
          ...(input.preview !== undefined && { preview: input.preview }),
          ...(input.metadata && { metadata: input.metadata }),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Quote created successfully!

Quote ID: ${quote.quote_id}
Status: ${quote.status}

Converting:
  From: ${describeAmount(quote.source)}
  To: ${describeAmount(quote.destination)}

Exchange Rate: ${quote.exchange_rate}
${feeLines(quote)}

Expires in: ${secondsUntil(quote.expires_at)} seconds
Expires at: ${quote.expires_at}

${
  quote.status === "preview"
    ? "This is a preview and was not persisted. Create a real quote before transferring."
    : "To execute it, call 'create_transfer' with this quote ID and the payout destination."
}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create quote: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Quote
  server.tool(
    "get_quote",
    "Get details about an existing quote including its current status",
    {
      quoteId: z.string().describe("The quote ID to look up"),
    },
    async ({ quoteId }) => {
      try {
        const quote = await client.getQuote(quoteId);

        let statusMessage: string;
        if (quote.status === "used") {
          statusMessage = "This quote has already been used to create a transfer.";
        } else if (quote.status === "cancelled") {
          statusMessage = "This quote has been cancelled.";
        } else if (quote.status === "expired" || new Date(quote.expires_at) < new Date()) {
          statusMessage = "This quote has expired. Create a new quote to proceed.";
        } else {
          statusMessage = `This quote is active and expires in ${secondsUntil(quote.expires_at)} seconds.`;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Quote Details:

Quote ID: ${quote.quote_id}
Status: ${quote.status}

Converting:
  From: ${describeAmount(quote.source)}
  To: ${describeAmount(quote.destination)}

Exchange Rate: ${quote.exchange_rate}
Total Fees: ${quote.fees.total_fee.amount} ${quote.fees.total_fee.currency}

Created: ${quote.created_at}
Expires: ${quote.expires_at}

${statusMessage}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get quote: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
