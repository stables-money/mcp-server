/**
 * Quote Tools for Stables MCP Server
 * Updated to match official Stables API docs
 * Supports paymentMethodType (SWIFT, LOCAL) for fiat payouts
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
      customerId: z.string().describe("The customer ID to create the quote for"),
      fromCurrency: z.string().describe("Source currency code (e.g., 'USDC', 'USDT', 'USD', 'EUR')"),
      fromAmount: z.string().describe("Amount to convert (e.g., '125.75')"),
      toCurrency: z.string().describe("Destination currency code (e.g., 'EUR', 'USD', 'USDC')"),
      toCountry: z.string().optional().describe("Destination country code for fiat payouts (e.g., 'GR', 'US', 'GB')"),
      fromNetwork: z.string().optional().describe("Blockchain network for crypto (e.g., 'polygon', 'ethereum', 'solana')"),
      paymentMethodType: z.enum(["SWIFT", "LOCAL"]).optional().describe("Payment method for fiat payouts - 'SWIFT' for international, 'LOCAL' for domestic rails"),
    },
    async ({ customerId, fromCurrency, fromAmount, toCurrency, toCountry, fromNetwork, paymentMethodType }) => {
      try {
        const response = await client.createQuote({
          customerId,
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

        return {
          content: [
            {
              type: "text",
              text: `Quote created successfully!

Quote ID: ${quote.quoteId}
Status: ${quote.status}

Converting:
  From: ${quote.from.amount} ${quote.from.currency}${quote.from.network ? ` (${quote.from.network})` : ""}
  To: ${quote.to.amount} ${quote.to.currency}${quote.to.paymentMethodType ? ` via ${quote.to.paymentMethodType}` : ""}

Exchange Rate: ${quote.exchangeRate}
Total Fees: ${quote.fees.totalFee.amount} ${quote.fees.totalFee.currency}

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

        let statusMessage = "";
        if (isUsed) {
          statusMessage = "This quote has already been used to create a transfer.";
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
  To: ${quote.to.amount} ${quote.to.currency}${quote.to.paymentMethodType ? ` via ${quote.to.paymentMethodType}` : ""}

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
