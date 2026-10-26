import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";

const BENEFICIARY_ID = "6f1d2c3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

describe("create_transfer", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "tr_1",
          type: "offramp",
          status: "created",
          customer_id: "cus_1",
          quote_id: "q_1",
          created_at: "2026-10-26T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "transfers-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const sentBody = () => JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

  it("pays a saved beneficiary by id, without bank details", async () => {
    const result = await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_1",
        destinationType: "beneficiary",
        beneficiaryId: BENEFICIARY_ID,
        // Ignored: the beneficiary supplies the bank details.
        bankName: "Chase",
        purposeCode: "SALARY",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/transfer");
    expect(sentBody()).toEqual({
      customer_id: "cus_1",
      quote_id: "q_1",
      destination: { type: "beneficiary", beneficiary_id: BENEFICIARY_ID },
      purpose_code: "SALARY",
    });
  });

  it("refuses a beneficiary destination without beneficiaryId, before calling the API", async () => {
    const result = await client.callTool({
      name: "create_transfer",
      arguments: { customerId: "cus_1", quoteId: "q_1", destinationType: "beneficiary" },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("needs beneficiaryId");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still defaults to a bank destination", async () => {
    await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_1",
        accountHolderName: "Jane Doe",
        bankName: "Chase",
        bankCountry: "US",
        bankCurrency: "USD",
        beneficiaryId: BENEFICIARY_ID,
      },
    });

    const { destination } = sentBody();
    expect(destination.type).toBe("bank");
    expect(destination.beneficiary_id).toBeUndefined();
  });
});
