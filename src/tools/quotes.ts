/**
 * Quote Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerQuoteTools(server: McpServer, client: StablesApiClient) {
  // Create Quote
  server.tool(
    "create_quote",
    "Get a quote for currency exchange. Quotes show the exchange rate, fees, and amount the customer will receive. Quotes expire after 30 seconds. Currently supports crypto → fiat (off-ramp) with more types coming soon.",
    {
      fromCurrency: z.enum(["USDC", "USDT"]).describe("Source cryptocurrency (USDC or USDT)"),
      fromAmount: z.string().describe("Amount to convert (e.g., '125.75')"),
      fromNetwork: z.enum(["ethereum", "polygon", "polygon-amoy"]).describe("Blockchain network for the source crypto"),
      toCurrency: z.string().describe("Destination currency code (e.g., 'EUR', 'USD', 'GBP')"),
      toCountry: z.string().describe("Destination country code (e.g., 'GR', 'US', 'GB')"),
      paymentMethodType: z.enum(["SWIFT", "LOCAL"]).describe("Payment method for fiat payouts - 'SWIFT' for international, 'LOCAL' for domestic rails"),
    },
    async ({ fromCurrency, fromAmount, fromNetwork, toCurrency, toCountry, paymentMethodType }) => {
      try {
        const response = await client.createQuote({
          from: {
            currency: fromCurrency,
            amount: fromAmount,
            network: fromNetwork,
          },
          to: {
            currency: toCurrency,
            country: toCountry,
            paymentMethodType,
          },
        });

        const quote = response.quote;
        const expiresIn = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));

        let feeDetails = `Total Fees: ${quote.fees.totalFee.amount} ${quote.fees.totalFee.currency}`;
        if (quote.fees.fxFee) feeDetails += `\n  FX Fee: ${quote.fees.fxFee.amount} ${quote.fees.fxFee.currency}`;
        if (quote.fees.platformFee) feeDetails += `\n  Platform Fee: ${quote.fees.platformFee.amount} ${quote.fees.platformFee.currency}`;
        if (quote.fees.paymentMethodFee) feeDetails += `\n  Payment Method Fee: ${quote.fees.paymentMethodFee.amount} ${quote.fees.paymentMethodFee.currency}`;
        if (quote.fees.networkFee) feeDetails += `\n  Network Fee: ${quote.fees.networkFee.amount} ${quote.fees.networkFee.currency}`;
        if (quote.fees.integratorFee) feeDetails += `\n  Integrator Fee: ${quote.fees.integratorFee.amount} ${quote.fees.integratorFee.currency}`;

        return {
          content: [
            {
              type: "text",
              text: `Quote created successfully!

Quote ID: ${quote.quoteId}
Status: ${quote.status}

Converting:
  From: ${quote.from.amount} ${quote.from.currency}${quote.from.network ? ` (${quote.from.network})` : ""}
  To: ${quote.to.amount} ${quote.to.currency} via ${quote.to.paymentMethodType}

Exchange Rate: ${quote.exchangeRate}
${feeDetails}

Expires in: ${expiresIn} seconds
Expires at: ${quote.expiresAt}

To execute this quote, use 'create_transfer' with this quoteId and include bank details for off-ramp transfers.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
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
        const response = await client.getQuote(quoteId);
        const quote = response.quote;

        const isExpired = quote.status === "QUOTE_STATUS_EXPIRED" || new Date(quote.expiresAt) < new Date();
        const isUsed = quote.status === "QUOTE_STATUS_USED";
        const isCancelled = quote.status === "QUOTE_STATUS_CANCELLED";

        let statusMessage = "";
        if (isUsed) {
          statusMessage = "This quote has already been used to create a transfer.";
        } else if (isCancelled) {
          statusMessage = "This quote has been cancelled.";
        } else if (isExpired) {
          statusMessage = "This quote has expired. Create a new quote to proceed.";
        } else {
          const expiresIn = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
          statusMessage = `This quote is active and expires in ${expiresIn} seconds.`;
        }

        return {
          content: [
            {
              type: "text",
              text: `Quote Details:

Quote ID: ${quote.quoteId}
Status: ${quote.status}

Converting:
  From: ${quote.from.amount} ${quote.from.currency}${quote.from.network ? ` (${quote.from.network})` : ""}
  To: ${quote.to.amount} ${quote.to.currency} via ${quote.to.paymentMethodType}

Exchange Rate: ${quote.exchangeRate}
Total Fees: ${quote.fees.totalFee.amount} ${quote.fees.totalFee.currency}

Created: ${quote.createdAt}
Expires: ${quote.expiresAt}

${statusMessage}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get quote: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
