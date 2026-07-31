/**
 * Webhook Management Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

/**
 * The tenant-facing subset the API accepts. Declared as an enum rather than
 * free strings so a wrong value is caught before the request instead of coming
 * back as a 400 the model has to guess its way out of.
 */
const WEBHOOK_EVENT_TYPES = [
  "customer.created",
  "customer.updated",
  "kyc_link.updated.status_transitioned",
  "transfer.created",
  "transfer.updated.status_transitioned",
  "quote.created",
  "quote.updated.status_transitioned",
  "virtual_account.created",
  "virtual_account.activity.created",
  "virtual_account.activity.updated.status_transitioned",
  "travel_rule.wallet_verification_required",
  "rfi.created",
  "rfi.updated",
  "rfi.resolved",
  "all",
] as const;

export function registerWebhookTools(server: McpServer, client: StablesApiClient) {
  // Create Webhook
  server.tool(
    "create_webhook",
    `Subscribe to Stables events via webhook. You'll receive POST requests to your URL when events occur.

Event types are dotted and lowercase. Use 'all' to receive everything.

Security: Set a secret to enable HMAC-SHA256 signature verification via X-Webhook-Signature header.`,
    {
      name: z
        .string()
        .describe("A descriptive name for this webhook (e.g., 'Transfer status notifications')"),
      url: z.string().url().describe("The HTTPS URL to receive webhook POST requests"),
      eventTypes: z
        .array(z.enum(WEBHOOK_EVENT_TYPES))
        .describe(
          "Event types to subscribe to (e.g. ['transfer.updated.status_transitioned']), or ['all']"
        ),
      secret: z
        .string()
        .optional()
        .describe("Optional signing secret for HMAC-SHA256 webhook signature verification"),
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

Common event types:
- transfer.updated.status_transitioned
- kyc_link.updated.status_transitioned
- virtual_account.activity.created
- rfi.created
- all (subscribe to everything)`,
              },
            ],
          };
        }

        const webhookList = response.subscriptions
          .map((w) => {
            const status = w.active ? "Active" : "Inactive";
            return `- ${w.subscriptionId}: "${w.name}" -> ${w.url} (${status})\n  Events: ${w.eventTypes.join(", ")}`;
          })
          .join("\n\n");

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

  // List Webhook Deliveries
  server.tool(
    "list_webhook_deliveries",
    "List recent webhook delivery attempts with their HTTP status and retry state. This is the first place to look when an integration is not receiving events: it shows whether Stables sent them and what the endpoint answered.",
    {
      pageSize: z.number().optional().describe("How many attempts to return (default 10, max 50)"),
      status: z
        .enum(["PENDING", "SUCCESS", "FAILED", "RETRYING"])
        .optional()
        .describe("Filter by delivery status"),
      eventType: z.string().optional().describe("Filter by event type (e.g. 'transfer.created')"),
    },
    async ({ pageSize, status, eventType }) => {
      try {
        const { deliveries } = await client.listWebhookDeliveries({
          pageSize: pageSize ?? 10,
          status,
          eventType,
        });

        if (!deliveries?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No webhook deliveries found. Attempts only exist where an active subscription matched an event — check 'list_webhooks' if you expected some.",
              },
            ],
          };
        }

        const list = deliveries
          .map((d) => {
            const code = d.responseCode ? ` HTTP ${d.responseCode}` : "";
            const attempts = d.attemptCount > 1 ? `, ${d.attemptCount} attempts` : "";
            const retry = d.nextRetryAt ? `, next retry ${d.nextRetryAt}` : "";
            const target = d.subscriptionName ?? d.subscriptionUrl ?? "endpoint removed";
            return `- ${d.eventType} → ${target}: ${d.status}${code}${attempts}${retry}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Recent webhook deliveries (${deliveries.length}):\n\n${list}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list webhook deliveries: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
