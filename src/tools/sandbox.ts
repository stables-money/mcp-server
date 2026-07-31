/**
 * Sandbox simulation tools for the Stables MCP Server.
 *
 * These endpoints exist only on non-live deployments. Without them an agent
 * cannot drive a deposit to a terminal state in test — a real bank payment would
 * be required — so a test integration could never see a completed payout.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerSandboxTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "simulate_route_deposit",
    "SANDBOX ONLY. Simulate a fiat deposit into a payment route so you can watch the conversion and payout complete without a real bank transfer. Fails on production.",
    {
      customerId: z.string().describe("The customer ID"),
      virtualAccountId: z.string().describe("The payment route (virtual account) ID"),
      amount: z.string().describe("Deposit amount in major units (e.g. '500.00')"),
      scenario: z
        .enum(["create_only", "completed", "failed"])
        .optional()
        .describe(
          "'completed' runs the deposit through to payout, 'failed' exercises the failure path, 'create_only' stops at the deposit"
        ),
      senderName: z.string().optional().describe("Name to attribute the deposit to"),
      senderReference: z.string().optional().describe("Payment reference on the deposit"),
      externalDepositId: z.string().optional().describe("Your own reference for this deposit"),
    },
    async ({
      customerId,
      virtualAccountId,
      amount,
      scenario,
      senderName,
      senderReference,
      externalDepositId,
    }) => {
      try {
        const result = await client.simulateVirtualAccountDeposit(customerId, virtualAccountId, {
          amount,
          ...(scenario && { scenario }),
          ...(senderName && { sender_name: senderName }),
          ...(senderReference && { sender_reference: senderReference }),
          ...(externalDepositId && { external_deposit_id: externalDepositId }),
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Simulated deposit of ${amount} into route ${virtualAccountId}:\n\n${JSON.stringify(result, null, 2)}\n\nUse 'get_virtual_account_history' to see the deposit and its payout.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to simulate the deposit: ${error instanceof Error ? error.message : "Unknown error"}\n\nThis endpoint exists only in sandbox — on production it will not be found.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "simulate_transfer_deposit",
    "SANDBOX ONLY. Simulate the customer sending the crypto an off-ramp transfer is waiting on, so the transfer can progress to payout without an on-chain payment. Fails on production.",
    {
      transferId: z.string().describe("The transfer awaiting funds"),
    },
    async ({ transferId }) => {
      try {
        const result = await client.simulateTransferDeposit(transferId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Simulated the inbound deposit for transfer ${transferId}:\n\n${JSON.stringify(result, null, 2)}\n\nUse 'get_transfer' to follow the status.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to simulate the transfer deposit: ${error instanceof Error ? error.message : "Unknown error"}\n\nThis endpoint exists only in sandbox — on production it will not be found.`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
