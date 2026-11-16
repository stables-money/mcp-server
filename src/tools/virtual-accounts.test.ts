import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";

const BENEFICIARY_ID = "6f1d2c3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
const ROUTE_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const offrampRoute = {
  id: ROUTE_ID,
  status: "activated",
  deactivation_reason: null,
  customer_id: "cus_1",
  created_at: "2026-11-15T08:42:10.512Z",
  source_deposit_instructions: {
    type: "crypto",
    wallet_address: "0x8f3a2b1c4d5e6f708192a3b4c5d6e7f809a1b2c3",
    currency: "usdt",
    network: "ethereum",
  },
  deposit_handling_mode: "auto_payout",
  workflow_type: "crypto_to_fiat",
  destination: null,
  fiat_destination: {
    type: "bank",
    account_holder_name: "Somchai Jaidee",
    account_number: "1234567890",
    bank_name: "Example Bank",
    bank_country: "TH",
    currency: "THB",
  },
  held_balance: null,
};

describe("payment route tools", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(offrampRoute), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "virtual-accounts-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const sentBody = () => JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  const text = (result: unknown) => JSON.stringify((result as { content: unknown }).content);

  it("switches a route off with PUT .../status", async () => {
    fetchSpy.mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({
            ...offrampRoute,
            status: "deactivated",
            deactivation_reason: "TENANT_REQUEST",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );

    const result = await client.callTool({
      name: "set_virtual_account_status",
      arguments: { customerId: "cus_1", virtualAccountId: ROUTE_ID, status: "deactivated" },
    });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      `https://api.test.stables.money/api/v1/customers/cus_1/virtual-accounts/${ROUTE_ID}/status`
    );
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("PUT");
    expect(sentBody()).toEqual({ status: "deactivated" });
    expect(text(result)).toContain("is now deactivated");
    expect(text(result)).toContain("TENANT_REQUEST");
  });

  it("creates an off-ramp route paying a saved beneficiary", async () => {
    const result = await client.callTool({
      name: "create_virtual_account",
      arguments: {
        customerId: "cus_1",
        workflowType: "crypto_to_fiat",
        sourceCurrency: "usdt",
        sourceNetwork: "ethereum",
        payoutType: "beneficiary",
        beneficiaryId: BENEFICIARY_ID,
        payoutNetwork: "swift",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.test.stables.money/api/v1/customers/cus_1/virtual-accounts"
    );
    expect(sentBody()).toEqual({
      source: { currency: "USDT", network: "ethereum" },
      workflow_type: "crypto_to_fiat",
      fiat_destination: { type: "beneficiary", beneficiary_id: BENEFICIARY_ID, network: "swift" },
    });
    expect(text(result)).toContain("0x8f3a2b1c4d5e6f708192a3b4c5d6e7f809a1b2c3");
    expect(text(result)).not.toContain("undefined");
  });

  it("creates an off-ramp route to a domestic bank account without a SWIFT code", async () => {
    const result = await client.callTool({
      name: "create_virtual_account",
      arguments: {
        customerId: "cus_1",
        workflowType: "crypto_to_fiat",
        sourceCurrency: "USDT",
        sourceNetwork: "ethereum",
        accountHolderName: "Somchai Jaidee",
        accountNumber: "1234567890",
        bankName: "Example Bank",
        bankCountry: "TH",
        bankCurrency: "THB",
        recipientType: "individual",
        payoutNetwork: "bank",
        purposeCode: "PERSONAL_REMITTANCE",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(sentBody()).toEqual({
      source: { currency: "USDT", network: "ethereum" },
      workflow_type: "crypto_to_fiat",
      fiat_destination: {
        type: "bank",
        account_holder_name: "Somchai Jaidee",
        account_number: "1234567890",
        bank_name: "Example Bank",
        bank_country: "TH",
        currency: "THB",
        recipient_type: "individual",
        network: "bank",
      },
      purpose_code: "PERSONAL_REMITTANCE",
    });
  });

  it("refuses a swift payout without swiftCode or bicCode, before calling the API", async () => {
    const result = await client.callTool({
      name: "create_virtual_account",
      arguments: {
        customerId: "cus_1",
        workflowType: "crypto_to_fiat",
        sourceCurrency: "USDT",
        sourceNetwork: "ethereum",
        accountHolderName: "Somchai Jaidee",
        accountNumber: "1234567890",
        bankName: "Example Bank",
        bankCountry: "TH",
        bankCurrency: "THB",
        payoutNetwork: "swift",
      },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("swiftCode or bicCode");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an off-ramp route without sourceNetwork", async () => {
    const result = await client.callTool({
      name: "create_virtual_account",
      arguments: {
        customerId: "cus_1",
        workflowType: "crypto_to_fiat",
        sourceCurrency: "USDT",
        payoutType: "beneficiary",
        beneficiaryId: BENEFICIARY_ID,
      },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("sourceNetwork");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps fiat_to_crypto as the default and requires its payout wallet", async () => {
    const refused = await client.callTool({
      name: "create_virtual_account",
      arguments: { customerId: "cus_1", sourceCurrency: "AUD" },
    });
    expect(refused.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    await client.callTool({
      name: "create_virtual_account",
      arguments: {
        customerId: "cus_1",
        sourceCurrency: "AUD",
        destinationAddress: "0xabc",
        destinationPaymentRail: "polygon",
      },
    });
    expect(sentBody()).toEqual({
      source: { currency: "AUD" },
      workflow_type: "fiat_to_crypto",
      destination: { currency: "usdt", payment_rail: "polygon", address: "0xabc" },
    });
  });

  it("get_virtual_account reads one route and shows its deposit address", async () => {
    const result = await client.callTool({
      name: "get_virtual_account",
      arguments: { customerId: "cus_1", virtualAccountId: ROUTE_ID },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `https://api.test.stables.money/api/v1/customers/cus_1/virtual-accounts/${ROUTE_ID}`
    );
    expect(text(result)).toContain("USDT on ethereum");
    expect(text(result)).toContain("Somchai Jaidee");
    expect(text(result)).not.toContain("undefined");
  });

  it("get_virtual_account is labelled read-only", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "get_virtual_account");
    expect(tool?.annotations?.readOnlyHint).toBe(true);
  });
});
