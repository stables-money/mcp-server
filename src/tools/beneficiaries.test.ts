import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StablesApiClient } from "../lib/stables-client.js";
import { createStablesMcpServer } from "../server.js";
import { accessOf } from "../tool-policy.js";

const ID = "6f1d2c3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

const beneficiary = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  label: "Acme Supplies (EUR)",
  status: "active",
  network: "bank",
  destination: {
    type: "bank",
    account_holder_name: "Acme Supplies GmbH",
    bank_name: "Deutsche Bank",
    bank_country: "DE",
    currency: "EUR",
    iban: "DE89370400440532013000",
  },
  validation: { valid: true },
  last_used_at: null,
  created_at: "2026-10-26T00:00:00.000Z",
  updated_at: "2026-10-26T00:00:00.000Z",
  archived_at: null,
  ...overrides,
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("beneficiary tools", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const server = createStablesMcpServer(
      new StablesApiClient("sti_test_unit_secret", "https://api.test.stables.money")
    );
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "beneficiaries-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  });

  afterEach(() => vi.unstubAllGlobals());

  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[]).map((c) => c.text).join("\n");
    return { result, text };
  };
  const request = () => ({
    url: new URL(fetchSpy.mock.calls[0][0] as string),
    init: fetchSpy.mock.calls[0][1] as RequestInit,
  });

  it("are labelled: reads are read, saving and archiving are write", () => {
    expect(accessOf("list_beneficiaries")).toBe("read");
    expect(accessOf("get_beneficiary")).toBe("read");
    expect(accessOf("create_beneficiary")).toBe("write");
    expect(accessOf("archive_beneficiary")).toBe("write");
  });

  it("list_beneficiaries sends snake_case filters and lists ids to pay", async () => {
    fetchSpy.mockResolvedValueOnce(
      json({ beneficiaries: [beneficiary()], page: { next_page_token: "", total: 1 } })
    );
    const { text } = await call("list_beneficiaries", {
      currency: "EUR",
      network: "bank",
      search: "acme",
      pageSize: 10,
    });

    const { url } = request();
    expect(url.pathname).toBe("/api/v1/beneficiaries");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      currency: "EUR",
      network: "bank",
      search: "acme",
      page_size: "10",
    });
    expect(text).toContain(`${ID}: Acme Supplies (EUR) - EUR by bank, Deutsche Bank (active)`);
    expect(text).not.toContain("pageToken");
  });

  it("get_beneficiary shows why a saved beneficiary no longer passes", async () => {
    fetchSpy.mockResolvedValueOnce(
      json(
        beneficiary({
          label: null,
          validation: {
            valid: false,
            errors: [{ field: "address", message: "Address is required", code: "INVALID_FIELDS" }],
          },
        })
      )
    );
    const { text } = await call("get_beneficiary", { beneficiaryId: ID });

    expect(request().url.pathname).toBe(`/api/v1/beneficiaries/${ID}`);
    // No label: falls back to the account holder.
    expect(text).toContain("Name: Acme Supplies GmbH");
    expect(text).toContain("Last paid: never");
    expect(text).toContain("address: Address is required (INVALID_FIELDS)");
  });

  it("create_beneficiary posts the network, label and bank destination", async () => {
    fetchSpy.mockResolvedValueOnce(json(beneficiary()));
    const { result } = await call("create_beneficiary", {
      network: "bank",
      label: "Acme Supplies (EUR)",
      accountHolderName: "Acme Supplies GmbH",
      bankName: "Deutsche Bank",
      bankCountry: "DE",
      bankCurrency: "EUR",
      recipientType: "business",
      iban: "DE89370400440532013000",
    });

    expect(result.isError).toBeFalsy();
    const { url, init } = request();
    expect(url.pathname).toBe("/api/v1/beneficiaries");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      network: "bank",
      label: "Acme Supplies (EUR)",
      destination: {
        type: "bank",
        account_holder_name: "Acme Supplies GmbH",
        bank_name: "Deutsche Bank",
        bank_country: "DE",
        currency: "EUR",
        recipient_type: "business",
        iban: "DE89370400440532013000",
      },
    });
  });

  it("create_beneficiary refuses missing bank basics before calling the API", async () => {
    const { result } = await call("create_beneficiary", { network: "swift", bankName: "X" });
    expect(result.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("archive_beneficiary sends DELETE and reports the new status", async () => {
    fetchSpy.mockResolvedValueOnce(json(beneficiary({ status: "archived" })));
    const { text } = await call("archive_beneficiary", { beneficiaryId: ID });

    const { url, init } = request();
    expect(url.pathname).toBe(`/api/v1/beneficiaries/${ID}`);
    expect(init.method).toBe("DELETE");
    expect(text).toBe(`Beneficiary ${ID} (Acme Supplies (EUR)) is archived.`);
  });
});
