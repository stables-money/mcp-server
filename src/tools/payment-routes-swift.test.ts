import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";

const TRON_ADDRESS = "TUVPATBKPjUuN5pBkigmfQtUR9yoYFhvv7";

function swiftAccount() {
  return {
    id: "va_1",
    status: "activated",
    customer_id: "cus_1",
    created_at: "2026-11-16T00:00:00.000Z",
    source_deposit_instructions: {
      currency: "eur",
      payment_rails: ["swift"],
      bank_name: "Example Bank",
      iban: "XX00EXAM00000000000000",
      bic: "EXAMPLEXXXX",
      account_holder_name: "Stables Entity Ltd.",
    },
    deposit_handling_mode: "auto_payout",
    destination: { currency: "usdt", payment_rail: "tron", address: TRON_ADDRESS },
    held_balance: null,
  };
}

describe("create_payment_route", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(swiftAccount()), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "payment-routes-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const sentBody = () => JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

  it("asks for the SWIFT rail when sourcePaymentRail is swift", async () => {
    const result = await client.callTool({
      name: "create_payment_route",
      arguments: {
        customerId: "cus_1",
        sourceCurrency: "EUR",
        sourcePaymentRail: "swift",
        destinationAddress: TRON_ADDRESS,
        destinationPaymentRail: "tron",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(sentBody().source).toEqual({ currency: "EUR", payment_rail: "swift" });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain("IBAN: XX00EXAM00000000000000");
    expect(text).toContain("BIC: EXAMPLEXXXX");
    expect(text).toContain("SWIFT collection account");
  });

  it("sends no rail when sourcePaymentRail is omitted", async () => {
    await client.callTool({
      name: "create_payment_route",
      arguments: {
        customerId: "cus_1",
        sourceCurrency: "AUD",
        destinationAddress: TRON_ADDRESS,
        destinationPaymentRail: "tron",
      },
    });

    expect(sentBody().source).toEqual({ currency: "AUD" });
  });

  it("offers base_pay_in when requesting entitlements", async () => {
    const { tools } = await client.listTools();
    const request = tools.find((tool) => tool.name === "request_entitlements");
    expect(JSON.stringify(request?.inputSchema)).toContain("base_pay_in");
  });
});
