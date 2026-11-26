import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";

const usdt = (amount: string) => ({ amount, currency: "USDT" });

describe("create_quote for a swap", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          quote_id: "q_swap",
          status: "active",
          source: { amount: "150", currency: "USDT", network: "tron" },
          destination: { amount: "142.2", currency: "USDC", network: "base" },
          exchange_rate: 0.9988,
          fees: {
            platform_fee: usdt("0.375"),
            total_fee: usdt("7.475"),
            stables_fees: {
              total: usdt("7.475"),
              conversion_fee: usdt("0.375"),
              orchestration_fee: usdt("7.1"),
            },
          },
          created_at: "2026-11-26T00:00:00.000Z",
          expires_at: "2026-11-26T00:05:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "quotes-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends both networks and no country, and shows the orchestration fee", async () => {
    const result = await client.callTool({
      name: "create_quote",
      arguments: {
        sourceCurrency: "USDT",
        sourceAmount: "150",
        sourceNetwork: "tron",
        destinationCurrency: "USDC",
        destinationNetwork: "base",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/quotes");
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      source: { currency: "USDT", amount: "150", network: "tron" },
      destination: { currency: "USDC", network: "base" },
    });
    const out = (result.content as Array<{ text: string }>)[0].text;
    expect(out).toContain("142.2 USDC (base)");
    expect(out).toContain("Orchestration Fee: 7.1 USDT");
    expect(out).toContain("Total Fees: 7.475 USDT");
  });

  const sentBody = () => JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  const offramp = {
    sourceCurrency: "USDT",
    sourceNetwork: "tron",
    destinationCurrency: "CNY",
    destinationCountry: "CN",
    destinationNetwork: "unionpay",
  };

  it("quotes an exact destination amount on a named network for a customer", async () => {
    const result = await client.callTool({
      name: "create_quote",
      arguments: { ...offramp, destinationAmount: "100", customerId: "cus_1" },
    });

    expect(result.isError).toBeFalsy();
    expect(sentBody()).toEqual({
      source: { currency: "USDT", network: "tron" },
      destination: { currency: "CNY", country: "CN", network: "unionpay", amount: "100" },
      customer_id: "cus_1",
    });
  });

  it("refuses both amounts and neither, before calling the API", async () => {
    for (const amounts of [{}, { sourceAmount: "150", destinationAmount: "100" }]) {
      const result = await client.callTool({
        name: "create_quote",
        arguments: { ...offramp, ...amounts },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain(
        "exactly one of sourceAmount or destinationAmount"
      );
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves funding_source out by default, so the API funds by deposit", async () => {
    await client.callTool({
      name: "create_quote",
      arguments: { ...offramp, sourceAmount: "150" },
    });
    expect(sentBody().funding_source).toBeUndefined();
  });

  it("sends prefund_balance only when asked, and says it needs human approval", async () => {
    await client.callTool({
      name: "create_quote",
      arguments: { ...offramp, sourceAmount: "150", fundingSource: "prefund_balance" },
    });
    expect(sentBody().funding_source).toBe("prefund_balance");

    const { tools } = await client.listTools();
    const schema = tools.find((t) => t.name === "create_quote")!.inputSchema as {
      properties: { fundingSource: { description: string } };
    };
    expect(schema.properties.fundingSource.description).toContain("explicit human approval");
  });
});
