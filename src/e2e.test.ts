/**
 * End-to-end test: the real MCP server against the real sandbox API.
 *
 * The contract test proves each request matches the spec, with fetch captured.
 * This one proves the tools work: it connects an MCP client to the server over
 * the MCP protocol, with a real API client, and calls the tools against
 * sandbox. A tool fails the test if it returns an error or renders "undefined",
 * "NaN" or "[object Object]".
 *
 * It changes nothing that stays changed: reads, a quote preview (not saved), a
 * payment-method validation (dry run), and two round trips it undoes (a test
 * webhook it deletes, a test document it removes). It never moves money.
 *
 * Needs a sandbox key; refuses a live one. Skipped without it.
 *   STABLES_E2E_API_KEY=sti_test_... npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "./lib/stables-client.js";
import { createStablesMcpServer } from "./server.js";

const KEY = process.env.STABLES_E2E_API_KEY?.trim() ?? "";
const API_URL = process.env.STABLES_E2E_API_URL ?? "https://api.sandbox.stables.money";
if (KEY && !KEY.startsWith("sti_test_")) {
  throw new Error(
    "STABLES_E2E_API_KEY must be a sandbox key (sti_test_...): this test calls the API"
  );
}

/** A one-page PDF, small enough to upload in a test. */
const PDF =
  "data:application/pdf;base64," +
  Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
  ).toString("base64");

describe.skipIf(!KEY)("MCP end to end against sandbox", () => {
  const api = new StablesApiClient(KEY, API_URL);
  let mcp: Client;
  const ids: Record<string, string> = {};
  const called = new Set<string>();

  /** Calls a tool over MCP and returns its text, failing on an error or a broken render. */
  async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
    called.add(name);
    const result = (await mcp.callTool({ name, arguments: args })) as {
      content: { type: string; text?: string }[];
      isError?: boolean;
    };
    const text = result.content.map((c) => c.text ?? "").join("\n");
    expect(result.isError, `${name} returned an error:\n${text}`).toBeFalsy();
    expect(text, `${name} rendered a missing field:\n${text}`).not.toMatch(
      /undefined|NaN|\[object Object\]/
    );
    return text;
  }

  beforeAll(async () => {
    const server = createStablesMcpServer(api);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    mcp = new Client({ name: "e2e", version: "1.0.0" });
    await mcp.connect(clientSide);

    // Real ids to read with, taken straight from the API.
    const customers = await api.listCustomers({ pageSize: 1 });
    if (customers.customers[0]) ids.customerId = customers.customers[0].customer_id;
    const transfers = await api.listTransfers({ pageSize: 1 });
    const transfer = transfers.transfers[0];
    if (transfer) {
      ids.transferId = transfer.id;
      if (transfer.quote_id) ids.quoteId = transfer.quote_id;
    }
    const routes = await api.listAllVirtualAccounts({ limit: 100 });
    const route = routes.data[0];
    if (route) {
      ids.virtualAccountId = route.id;
      ids.routeCustomerId = route.customer_id;
    }
    for (const r of routes.data.filter((r) =>
      JSON.stringify(r.source_deposit_instructions ?? {})
        .toLowerCase()
        .includes('"aud"')
    )) {
      try {
        await api.listRouteWhitelist(r.customer_id, r.id);
        ids.audRouteId = r.id;
        ids.audCustomerId = r.customer_id;
        break;
      } catch {
        // not a route that supports whitelisting; try the next one
      }
    }
    const rfis = await api.listRfis({ limit: 1, status: ["open", "submitted", "satisfied"] });
    const rfi = rfis.rfis[0];
    if (rfi) {
      ids.rfiId = rfi.rfi_id;
      ids.rfiCustomerId = rfi.customer_id;
      const evidence = rfi.requirements.find((r) => r.type === "evidence");
      if (evidence) ids.evidenceRequirementId = evidence.requirement_id;
    }
    const keys = await api.listApiKeys();
    if (keys.apiKeys[0]) ids.apiKeyId = keys.apiKeys[0].apiKeyId;
  }, 60_000);

  afterAll(async () => {
    await mcp?.close();
  });

  it("lists every tool", async () => {
    const { tools } = await mcp.listTools();
    expect(tools.length).toBeGreaterThan(40);
  });

  it("reads customers, verification and RFIs", async () => {
    await call("list_customers", { pageSize: 5 });
    expect(ids.customerId, "sandbox has no customer to read").toBeTruthy();
    await call("get_customer", { customerId: ids.customerId });
    await call("get_kyc_capabilities", { customerId: ids.customerId });
    await call("list_available_entitlements", { customerId: ids.customerId });
    await call("list_customer_rfis", { customerId: ids.customerId });
    await call("list_rfis", {});
    if (ids.rfiId) {
      await call("get_rfi", { rfiId: ids.rfiId });
      if (ids.evidenceRequirementId) {
        await call("get_rfi_evidence_form", {
          customerId: ids.rfiCustomerId,
          rfiId: ids.rfiId,
          requirementId: ids.evidenceRequirementId,
        });
      }
    }
  }, 60_000);

  it("reads transfers and quotes, prices a quote and validates payout details", async () => {
    await call("list_transfers", { pageSize: 5 });
    expect(ids.transferId, "sandbox has no transfer to read").toBeTruthy();
    await call("get_transfer", { transferId: ids.transferId });
    if (ids.quoteId) await call("get_quote", { quoteId: ids.quoteId });
    // Sandbox only prices the corridors it has liquidity for, so try a few and need one.
    const corridors = [
      {
        sourceCurrency: "USDT",
        sourceNetwork: "polygon",
        destinationCurrency: "USD",
        destinationCountry: "US",
      },
      {
        sourceCurrency: "USDC",
        sourceNetwork: "ethereum",
        destinationCurrency: "USD",
        destinationCountry: "US",
      },
      {
        sourceCurrency: "USDT",
        sourceNetwork: "tron",
        destinationCurrency: "PHP",
        destinationCountry: "PH",
      },
      {
        sourceCurrency: "USDT",
        sourceNetwork: "polygon",
        destinationCurrency: "AUD",
        destinationCountry: "AU",
      },
    ];
    let priced = "";
    for (const corridor of corridors) {
      const result = (await mcp.callTool({
        name: "create_quote",
        arguments: { ...corridor, sourceAmount: "100", destinationNetwork: "bank", preview: true },
      })) as { content: { text?: string }[]; isError?: boolean };
      if (!result.isError) {
        priced = result.content.map((c) => c.text ?? "").join("\n");
        break;
      }
    }
    called.add("create_quote");
    expect(priced, "create_quote priced none of the sandbox corridors").toBeTruthy();
    expect(priced).not.toMatch(/undefined|NaN|\[object Object\]/);
    // A rejection is the expected answer here: it proves the dry run reaches the corridor rules.
    called.add("validate_payment_method");
    const validation = (await mcp.callTool({
      name: "validate_payment_method",
      arguments: { network: "bank", bankCurrency: "EUR", bankCountry: "DE", bankName: "Test Bank" },
    })) as { content: { text?: string }[] };
    expect(validation.content[0]?.text).toMatch(/valid|required|needs/i);
  }, 60_000);

  it("reads payment routes and their history", async () => {
    await call("list_virtual_accounts", {});
    expect(ids.virtualAccountId, "sandbox has no payment route to read").toBeTruthy();
    await call("list_virtual_accounts", { customerId: ids.routeCustomerId });
    await call("get_virtual_account_history", {
      customerId: ids.routeCustomerId,
      virtualAccountId: ids.virtualAccountId,
    });
    if (ids.audRouteId) {
      await call("list_route_whitelist", {
        customerId: ids.audCustomerId,
        virtualAccountId: ids.audRouteId,
      });
    }
  }, 60_000);

  it("reads the balance", async () => {
    await call("get_balance");
    await call("get_balance_wallet", { network: "polygon" });
    await call("list_balance_activity", {});
    await call("list_pending_balance_deposits");
    await call("list_whitelisted_wallets", {});
  }, 60_000);

  it("reads API keys and webhook deliveries", async () => {
    await call("list_api_keys", {});
    if (ids.apiKeyId) await call("get_api_key", { apiKeyId: ids.apiKeyId });
    await call("list_webhooks");
    await call("list_webhook_deliveries", { pageSize: 5 });
  }, 60_000);

  it("creates a webhook and deletes it again", async () => {
    const created = await call("create_webhook", {
      name: "mcp e2e test (deleted straight away)",
      url: "https://example.com/stables-mcp-e2e",
      eventTypes: ["rfi.created"],
    });
    const webhookId = created.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    )?.[0];
    expect(webhookId, `no webhook id in:\n${created}`).toBeTruthy();
    await call("delete_webhook", { webhookId });
  }, 60_000);

  it("attaches a document to a transfer, reads it back and removes it", async () => {
    expect(ids.transferId).toBeTruthy();
    const on = "transfer";
    const transactionId = ids.transferId;
    const added = await call("add_document", {
      on,
      transactionId,
      fileName: "mcp-e2e-test.pdf",
      base64Url: PDF,
      type: "other",
    });
    const documentId = added.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    )?.[0];
    expect(documentId, `no document id in:\n${added}`).toBeTruthy();
    try {
      expect(await call("list_documents", { on, transactionId })).toContain(documentId);
      expect(await call("get_document_download_url", { on, transactionId, documentId })).toMatch(
        /https:\/\//
      );
    } finally {
      await call("delete_document", { on, transactionId, documentId });
    }
  }, 60_000);

  it("reports which tools it could not exercise", () => {
    // Not a failure: these change sandbox data in ways a test can't undo, or need state sandbox may lack.
    // eslint-disable-next-line no-console
    console.log(`e2e: called ${called.size} tools: ${[...called].sort().join(", ")}`);
  });
});
