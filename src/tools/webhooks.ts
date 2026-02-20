/**
 * Webhook Management Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerWebhookTools(server: McpServer, client: StablesApiClient) {
  // Create Webhook
  server.tool(
    "create_webhook",
    `Subscribe to Stables events via webhook. You'll receive POST requests to your URL when events occur.

Available event types:
- WEBHOOK_EVENT_TYPE_CUSTOMER_CREATED
- WEBHOOK_EVENT_TYPE_CUSTOMER_UPDATED
- WEBHOOK_EVENT_TYPE_KYC_STATUS_CHANGED
- WEBHOOK_EVENT_TYPE_PAYMENT_CREATED
- WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED
- WEBHOOK_EVENT_TYPE_QUOTE_CREATED
- WEBHOOK_EVENT_TYPE_QUOTE_EXPIRED
- WEBHOOK_EVENT_TYPE_VA_DEPOSIT_RECEIVED
- WEBHOOK_EVENT_TYPE_VA_PAYOUT_COMPLETED
- WEBHOOK_EVENT_TYPE_VA_PAYOUT_FAILED
- WEBHOOK_EVENT_TYPE_ALL

Security: Set a secret to enable HMAC-SHA256 signature verification via X-Webhook-Signature header.`,
    {
      name: z.string().describe("A descriptive name for this webhook (e.g., 'Payment Status Notifications')"),
      url: z.string().url().describe("The HTTPS URL to receive webhook POST requests"),
      eventTypes: z.array(z.string()).describe("List of event types to subscribe to (e.g., ['WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED'])"),
      secret: z.string().optional().describe("Optional signing secret for HMAC-SHA256 webhook signature verification"),
    },
    async ({ name, url, eventTypes, secret }) => {
      try {
        const response = await client.createWebhook({ name, url, eventTypes, secret });
        const webhook = response.subscription;

        return {
          content: [
            {
              type: "text",
              text: `Webhook created successfully!

Subscription ID: ${webhook.subscriptionId}
Name: ${webhook.name}
URL: ${webhook.url}
Event Types: ${webhook.eventTypes.join(", ")}
Active: ${webhook.active ? "Yes" : "No"}
${secret ? "Signing Secret: Configured (verify via X-Webhook-Signature header)" : "Signing Secret: Not set"}
Created: ${webhook.createdAt}

Your endpoint will now receive POST requests when these events occur.
Tip: Return 200 quickly and process events asynchronously. Use eventId for idempotency.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Webhooks
  server.tool(
    "list_webhooks",
    "List all webhook subscriptions for the current account",
    {},
    async () => {
      try {
        const response = await client.listWebhooks();

        if (response.subscriptions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No webhooks configured. Use 'create_webhook' to subscribe to events.

Available event types include:
- WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED
- WEBHOOK_EVENT_TYPE_KYC_STATUS_CHANGED
- WEBHOOK_EVENT_TYPE_VA_DEPOSIT_RECEIVED
- WEBHOOK_EVENT_TYPE_ALL (subscribe to everything)`,
              },
            ],
          };
        }

        const webhookList = response.subscriptions.map((w) => {
          const status = w.active ? "Active" : "Inactive";
          return `- ${w.subscriptionId}: "${w.name}" -> ${w.url} (${status})\n  Events: ${w.eventTypes.join(", ")}`;
        }).join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Webhooks (${response.subscriptions.length}):

${webhookList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list webhooks: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete Webhook
  server.tool(
    "delete_webhook",
    "Delete a webhook subscription. You will stop receiving events at this endpoint.",
    {
      webhookId: z.string().describe("The webhook subscription ID to delete"),
    },
    async ({ webhookId }) => {
      try {
        await client.deleteWebhook(webhookId);

        return {
          content: [
            {
              type: "text",
              text: `Webhook ${webhookId} has been deleted. You will no longer receive events at this endpoint.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to delete webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
