import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";

describe("developer fee and balance sandbox tools", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            developer_fee_percent: "1.25",
            developer_fee_fixed_amount: null,
            deposit_id: "dep_1",
            tx_hash: "0xabc",
            status: "credited",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "developer-fee-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const call = (i = 0) => fetchSpy.mock.calls[i] as [string, RequestInit];
  const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
    (result.content as Array<{ text: string }>)[0].text;

  it("reads the developer fee", async () => {
    const result = await client.callTool({ name: "get_developer_fee", arguments: {} });

    expect(call()[0]).toBe("https://api.test.stables.money/api/v1/developer-fee");
    expect(textOf(result)).toContain("1.25%");
  });

  it("sets only the parts given, and null stops a part", async () => {
    await client.callTool({
      name: "set_developer_fee",
      arguments: { percent: "1.25", fixedAmountUsd: null },
    });

    expect(call()[1].method).toBe("PUT");
    expect(JSON.parse(call()[1].body as string)).toEqual({
      developer_fee_percent: "1.25",
      developer_fee_fixed_amount: null,
    });
  });

  it("refuses a set with no parts, without calling the API", async () => {
    const result = await client.callTool({ name: "set_developer_fee", arguments: {} });

    expect(result.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("removes the developer fee", async () => {
    await client.callTool({ name: "remove_developer_fee", arguments: {} });

    expect(call()[1].method).toBe("DELETE");
  });

  it("simulates a USDT balance deposit on a network", async () => {
    const result = await client.callTool({
      name: "simulate_balance_deposit",
      arguments: { network: "tron", amount: "250" },
    });

    expect(call()[0]).toBe(
      "https://api.test.stables.money/api/v1/prefund/wallet/tron/sandbox/simulate-deposit"
    );
    expect(JSON.parse(call()[1].body as string)).toEqual({ amount: "250", currency: "USDT" });
    expect(textOf(result)).toContain("credited");
  });
});
