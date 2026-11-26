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

  it("creates a swap to a wallet and describes it as a swap", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "tr_2",
          type: "swap",
          status: "awaiting_funds_collection",
          customer_id: "cus_1",
          quote_id: "q_2",
          created_at: "2026-11-26T00:00:00.000Z",
          source_deposit_instructions: {
            wallet_address: "TNz1FBKKAKZnYe76rH9XwhKt57PzoMGKyX",
            currency: "USDT",
            network: "tron",
            amount: "150",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_2",
        destinationType: "crypto",
        destinationCurrency: "USDC",
        destinationNetwork: "base",
        destinationAddress: "0x2f61a3b4c5d6e7f809a1b2c38f3a2b1c4d5ec386",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(sentBody()).toEqual({
      customer_id: "cus_1",
      quote_id: "q_2",
      destination: {
        type: "crypto",
        currency: "USDC",
        network: "base",
        address: "0x2f61a3b4c5d6e7f809a1b2c38f3a2b1c4d5ec386",
      },
    });
    const out = (result.content as Array<{ text: string }>)[0].text;
    expect(out).toContain("Swap (Crypto to Crypto)");
    expect(out).toContain("TNz1FBKKAKZnYe76rH9XwhKt57PzoMGKyX");
    expect(out).toContain("delivers the swap to the destination wallet");
  });

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

  it("pays a mobile money wallet without bank fields", async () => {
    const result = await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_1",
        accountHolderName: "Kwame Mensah",
        bankCountry: "GH",
        bankCurrency: "GHS",
        walletProvider: "mtn_gh",
        walletAccount: "+233241234567",
        walletAccountType: "mobile_number",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(sentBody().destination).toEqual({
      type: "bank",
      account_holder_name: "Kwame Mensah",
      bank_country: "GH",
      currency: "GHS",
      wallet_provider: "mtn_gh",
      wallet_account: "+233241234567",
      wallet_account_type: "mobile_number",
    });
  });

  it("refuses a wallet without walletAccount, and a wallet with bank fields", async () => {
    const wallet = {
      customerId: "cus_1",
      quoteId: "q_1",
      accountHolderName: "Kwame Mensah",
      bankCountry: "GH",
      bankCurrency: "GHS",
      walletProvider: "mtn_gh",
    };
    const incomplete = await client.callTool({ name: "create_transfer", arguments: wallet });
    expect(incomplete.isError).toBe(true);
    expect(JSON.stringify(incomplete.content)).toContain("walletProvider and walletAccount");

    const mixed = await client.callTool({
      name: "create_transfer",
      arguments: { ...wallet, walletAccount: "+233241234567", bankName: "GCB", iban: "GH00" },
    });
    expect(mixed.isError).toBe(true);
    expect(JSON.stringify(mixed.content)).toContain("Remove: iban, bankName");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still requires bankName for a bank account", async () => {
    const result = await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_1",
        accountHolderName: "Jane Doe",
        bankCountry: "US",
        bankCurrency: "USD",
      },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("bankName");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  const usBank = {
    customerId: "cus_1",
    quoteId: "q_1",
    accountHolderName: "Jane Doe",
    bankName: "Chase",
    bankCountry: "US",
    bankCurrency: "USD",
  };

  it("sends a partial address and bank address as given, with street and country", async () => {
    await client.callTool({
      name: "create_transfer",
      arguments: {
        ...usBank,
        addressStreet: "1 Market St",
        addressCountry: "us",
        bankAddressStreet: "270 Park Ave",
        bankAddressCity: "New York",
        bankAddressCountry: "us",
      },
    });

    const { destination } = sentBody();
    expect(destination.address).toEqual({ street: "1 Market St", country: "us" });
    expect(destination.bank_address).toEqual({
      street: "270 Park Ave",
      city: "New York",
      country: "us",
    });
  });

  it("refuses an address without street or country instead of dropping it", async () => {
    const result = await client.callTool({
      name: "create_transfer",
      arguments: { ...usBank, addressCity: "San Francisco", addressCountry: "us" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("addressStreet and addressCountry");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps the CNY goods-trade fields, payment rail and top-level extras to the wire", async () => {
    await client.callTool({
      name: "create_transfer",
      arguments: {
        ...usBank,
        phone: "+8613800138000",
        branchName: "Pudong",
        paymentRail: "wire",
        nameInLocalLanguage: "张伟",
        nationalIdentificationNumber: "110101199003070000",
        logisticsTrackingDetails: [
          { trackingNumber: "SF123", logisticsProvider: { name: "SF Express", code: "SF" } },
        ],
        items: [{ name: "Components", quantity: 5, unitPrice: "20.00" }],
        documents: [{ type: "invoice", base64Url: "data:application/pdf;base64,JVBERi0x" }],
        purposeCode: "GENERAL_GOODS_TRADES",
        paymentReference: "INV-2026-0042",
        accountOwnership: "third_party",
        sourceWallet: { type: "hosted", vaspName: "Example Exchange" },
      },
    });

    const body = sentBody();
    expect(body.destination).toMatchObject({
      phone: "+8613800138000",
      branch_name: "Pudong",
      payment_rail: "wire",
      name_in_local_language: "张伟",
      national_identification_number: "110101199003070000",
      logistics_tracking_details: [
        { tracking_number: "SF123", logistics_provider: { name: "SF Express", code: "SF" } },
      ],
      items: [{ name: "Components", quantity: 5, unit_price: "20.00" }],
      documents: [{ type: "invoice", base64_url: "data:application/pdf;base64,JVBERi0x" }],
    });
    expect(body.payment_reference).toBe("INV-2026-0042");
    expect(body.account_ownership).toBe("third_party");
    expect(body.source_wallet).toEqual({ type: "hosted", vasp_name: "Example Exchange" });
    // Not set, so not sent: the API defaults to fund_transfer.
    expect(body.funding_source).toBeUndefined();
  });

  it("sends the goods details with a saved beneficiary", async () => {
    await client.callTool({
      name: "create_transfer",
      arguments: {
        customerId: "cus_1",
        quoteId: "q_1",
        destinationType: "beneficiary",
        beneficiaryId: BENEFICIARY_ID,
        items: [{ name: "Components", quantity: 5, unitPrice: "20.00" }],
      },
    });

    expect(sentBody().destination).toEqual({
      type: "beneficiary",
      beneficiary_id: BENEFICIARY_ID,
      items: [{ name: "Components", quantity: 5, unit_price: "20.00" }],
    });
  });
});

describe("validate_payment_method, get_transfer and list_transfers", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  beforeEach(async () => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "transfers-read-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const textOf = (result: unknown) =>
    (result as { content: { text: string }[] }).content.map((c) => c.text).join("\n");

  it("validates a unionpay payout with its purpose code", async () => {
    fetchSpy.mockResolvedValueOnce(json({ valid: true }));
    const result = await client.callTool({
      name: "validate_payment_method",
      arguments: {
        network: "unionpay",
        quoteId: "q_1",
        purposeCode: "PERSONAL_REMITTANCE",
        accountHolderName: "Zhang Wei",
        bankName: "Bank of China",
        bankCountry: "CN",
        bankCurrency: "CNY",
        accountNumber: "6222000000000000",
        nameInLocalLanguage: "张伟",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.test.stables.money/api/v1/payment-methods/validate"
    );
    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      network: "unionpay",
      quote_id: "q_1",
      purpose_code: "PERSONAL_REMITTANCE",
      destination: {
        type: "bank",
        account_holder_name: "Zhang Wei",
        bank_name: "Bank of China",
        bank_country: "CN",
        currency: "CNY",
        account_number: "6222000000000000",
        name_in_local_language: "张伟",
      },
    });
  });

  it("accepts every payout network the API names and refuses others", async () => {
    const { tools } = await client.listTools();
    const schema = tools.find((t) => t.name === "validate_payment_method")!.inputSchema as {
      properties: { network: { enum: string[] } };
    };
    expect(schema.properties.network.enum).toEqual([
      "swift",
      "bank",
      "payid",
      "mobile_money",
      "ach",
      "fedwire",
      "fps",
      "chaps",
      "sepa",
      "sepa_instant",
      "fast",
      "chats",
      "unionpay",
    ]);
  });

  const transfer = {
    id: "tr_1",
    type: "offramp",
    customer_id: "cus_1",
    quote_id: "q_1",
    created_at: "2026-11-26T00:00:00.000Z",
    updated_at: "2026-11-26T01:00:00.000Z",
  };

  it("get_transfer shows the reference, tracking, hold and refund when present", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({
        ...transfer,
        status: "refund_pending",
        payment_reference: "INV-2026-0042",
        account_ownership: "third_party",
        tracking: [
          { type: "uetr", data: { number: "0c795041-3248-4dac-9c60-f0e916452bc5" } },
          {
            type: "mt103",
            data: {
              file: {
                type: "mt103",
                name: "mt103.txt",
                content: ":20:REF123",
                media_type: "text/plain",
              },
            },
          },
        ],
        compliance_hold: {
          rfi_id: "rfi_1",
          reasons: [{ reason_code: "SOF", description: "Source of funds needed" }],
          requirements: [
            { type: "EVIDENCE", required_evidence: "source_of_funds", status: "missing" },
          ],
        },
        refund: {
          status: "processing",
          amount: "100",
          fee: "1",
          net: "99",
          currency: "USDT",
          destination: { type: "original_source", currency: "USDT" },
          requested_at: "2026-11-26T00:30:00.000Z",
        },
      })
    );
    const out = textOf(
      await client.callTool({ name: "get_transfer", arguments: { transferId: "tr_1" } })
    );

    expect(out).toContain("Payment Reference: INV-2026-0042");
    expect(out).toContain("Account Ownership: third_party");
    expect(out).toContain("Tracking (uetr): 0c795041-3248-4dac-9c60-f0e916452bc5");
    expect(out).toContain("Tracking (mt103): mt103.txt (text/plain)");
    expect(out).toContain(":20:REF123");
    expect(out).toContain("Compliance Hold (RFI rfi_1");
    expect(out).toContain("Requirement: EVIDENCE source_of_funds - missing");
    expect(out).toContain("Refund: processing");
    expect(out).toContain("Amount: 100 USDT (fee 1, net 99)");
    expect(out).toContain("Returned to: the original source");
    expect(out).toContain("A refund of this transfer is in progress.");
    expect(out).not.toContain("undefined");
  });

  it("get_transfer adds nothing for a transfer without those fields", async () => {
    fetchSpy.mockResolvedValueOnce(json({ ...transfer, status: "completed" }));
    const out = textOf(
      await client.callTool({ name: "get_transfer", arguments: { transferId: "tr_1" } })
    );
    expect(out).not.toMatch(/Tracking|Refund|Compliance Hold|Payment Reference/);
  });

  it.each(["refund_pending", "refunded", "refund_failed"])(
    "list_transfers filters by %s",
    async (status) => {
      fetchSpy.mockResolvedValueOnce(
        json({ transfers: [{ ...transfer, status }], page: { next_page_token: "", total: 1 } })
      );
      const result = await client.callTool({ name: "list_transfers", arguments: { status } });

      expect(result.isError).toBeFalsy();
      expect(new URL(fetchSpy.mock.calls[0][0] as string).searchParams.get("status")).toBe(status);
      expect(textOf(result)).toContain(`tr_1: Off-ramp - ${status}`);
    }
  );
});
