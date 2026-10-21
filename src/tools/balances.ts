/**
 * Balance Tools for Stables MCP Server
 *
 * Mirrors the Balances section of docs.stables.money: your organisation's own
 * stablecoin balance, the deposit wallets that top it up, and the whitelisted
 * wallets allowed to send to it. The API paths say "prefund"; the docs and the
 * dashboard call it the balance, so the tools do too.
 *
 * Balances are enabled per organisation. A 404 means the feature is off for this
 * account, not that something is broken, and the tools say so.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError } from "../lib/stables-client.js";

const NETWORKS = ["ethereum", "polygon", "solana", "tron"] as const;

function formatError(error: unknown): string {
  if (error instanceof StablesApiError && error.statusCode === 404) {
    return "Balances are not enabled for this organisation (HTTP 404). Ask your Stables representative to switch them on.";
  }
  if (error instanceof StablesApiError) return `${error.message} (HTTP ${error.statusCode})`;
  return error instanceof Error ? error.message : "Unknown error";
}

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], ...(isError && { isError }) };
}

function nextPage(token: string | null | undefined): string {
  return token ? `\n\nMore results: pass pageToken "${token}".` : "";
}

export function registerBalanceTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "get_balance",
    "Get your organisation's stablecoin balance, one entry per asset and network held. Also says whether transfers may be paid from it (transfers_enabled), which create_transfer with fundingSource 'prefund_balance' needs.",
    {},
    async () => {
      try {
        const result = await client.getBalance();
        const lines = result.balances.map(
          (b) =>
            `- ${b.amount} ${b.currency.toUpperCase()} on ${b.network}` +
            (b.available !== undefined ? ` (available ${b.available})` : "")
        );
        return text(
          `${lines.length > 0 ? `Balance:\n${lines.join("\n")}` : "No balance yet. It is empty until a first deposit credits; use get_balance_wallet for a deposit address."}

Transfers from balance: ${result.transfers_enabled ? "enabled" : "not enabled"}`
        );
      } catch (error) {
        return text(`Failed to get balance: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "get_balance_wallet",
    "Get the deposit wallet that tops up your balance on one network, and its status. The address is only present once the status is 'active'.",
    {
      network: z.enum(NETWORKS).optional().describe("Network (default polygon)"),
    },
    async ({ network }) => {
      try {
        const result = await client.getBalanceWallet(network);
        if (result.status !== "active" || !result.wallet) {
          return text(
            `Balance wallet on ${network ?? "polygon"}: ${result.status}.` +
              (result.status === "not_created" ? " Use create_balance_wallet to create one." : "")
          );
        }
        return text(`Balance wallet on ${result.wallet.network}: active

Address: ${result.wallet.address}
Accepts: ${(result.wallet.currencies ?? []).join(", ").toUpperCase() || "-"}

Deposits from a wallet that is not whitelisted are held for review (see list_pending_balance_deposits).`);
      } catch (error) {
        return text(`Failed to get balance wallet: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "create_balance_wallet",
    "Create the deposit wallet that tops up your balance on a network. Creation is asynchronous: the first answer is 'creating'; poll get_balance_wallet until it is 'active'. Safe to call again while creation is in flight.",
    {
      network: z.enum(NETWORKS).describe("Network for the wallet"),
    },
    async ({ network }) => {
      try {
        const result = await client.createBalanceWallet(network);
        return text(
          result.wallet?.address
            ? `Balance wallet on ${network}: ${result.status}\nAddress: ${result.wallet.address}`
            : `Balance wallet on ${network}: ${result.status}. Poll get_balance_wallet until it is active.`
        );
      } catch (error) {
        return text(`Failed to create balance wallet: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "list_balance_activity",
    "List deposits that have credited your balance, newest first, with amount, network, transaction hash and sender.",
    {
      network: z.enum(NETWORKS).optional().describe("Only this network"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Results per page (default 20)"),
      pageToken: z.string().optional().describe("next_page_token from the previous page"),
    },
    async (params) => {
      try {
        const result = await client.listBalanceActivity(params);
        if (result.data.length === 0) return text("No balance deposits yet.");
        const lines = result.data.map(
          (d) =>
            `- ${d.created_at}: ${d.amount} ${d.currency.toUpperCase()} on ${d.network ?? "-"} from ${d.from_address ?? "-"} (${d.status})${d.tx_hash ? ` tx ${d.tx_hash}` : ""}`
        );
        return text(`Balance activity:\n${lines.join("\n")}${nextPage(result.next_page_token)}`);
      } catch (error) {
        return text(`Failed to list balance activity: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "list_pending_balance_deposits",
    "List deposits seen on-chain but held before crediting your balance, with the reason: the sender is not a whitelisted wallet, or compliance review.",
    {},
    async () => {
      try {
        const result = await client.listPendingBalanceDeposits();
        if (result.data.length === 0) return text("No deposits are held.");
        const lines = result.data.map(
          (d) =>
            `- ${d.id}: ${d.amount} ${d.currency.toUpperCase()} on ${d.network ?? "-"} from ${d.from_address ?? "-"}, held: ${d.reason.replace(/_/g, " ")}`
        );
        return text(`Held deposits:\n${lines.join("\n")}`);
      } catch (error) {
        return text(`Failed to list held deposits: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "list_whitelisted_wallets",
    "List the wallets whitelisted to deposit into and receive withdrawals from your balance. Only 'active' wallets can. Whitelisting a wallet is done in the dashboard; there is no API for it.",
    {
      status: z
        .enum(["pending_review", "active", "rejected", "deactivated", "archived"])
        .optional()
        .describe("Only this status. Archived wallets appear only when asked for"),
      network: z.enum(NETWORKS).optional().describe("Only this network"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Results per page (default 20)"),
      pageToken: z.string().optional().describe("next_page_token from the previous page"),
    },
    async (params) => {
      try {
        const result = await client.listWhitelistedWallets(params);
        if (result.data.length === 0) {
          return text(
            params.status || params.network
              ? "No whitelisted wallets match that filter."
              : "No whitelisted wallets. Whitelist one in the Stables dashboard."
          );
        }
        const lines = result.data.map(
          (w) =>
            `- ${w.name}: ${w.address} on ${w.network} (${w.status})${w.rejection_reason ? `, rejected: ${w.rejection_reason}` : ""}`
        );
        return text(`Whitelisted wallets:\n${lines.join("\n")}${nextPage(result.next_page_token)}`);
      } catch (error) {
        return text(`Failed to list whitelisted wallets: ${formatError(error)}`, true);
      }
    }
  );
}
