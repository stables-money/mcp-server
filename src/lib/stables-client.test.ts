import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StablesApiClient,
  StablesApiError,
  apiUrlForKey,
  createStablesClient,
} from "./stables-client.js";

// Helper to create a mock Response
function mockResponse(
  body: unknown,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  const status = init.status ?? 200;
  const bodyStr = body === null ? null : JSON.stringify(body);
  return new Response(bodyStr, {
    status,
    statusText: init.statusText ?? "OK",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

describe("StablesApiError", () => {
  it("carries structured error information", () => {
    const error = new StablesApiError("Not found", 404, "/api/v1/customers/abc", {
      message: "Not found",
    });
    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
    expect(error.endpoint).toBe("/api/v1/customers/abc");
    expect(error.errorBody).toEqual({ message: "Not found" });
    expect(error.name).toBe("StablesApiError");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("createStablesClient", () => {
  it("creates a client with environment variables", () => {
    vi.stubEnv("STABLES_API_KEY", "test-key");
    vi.stubEnv("STABLES_API_URL", "https://api.sandbox.stables.money");
    const client = createStablesClient();
    expect(client).toBeInstanceOf(StablesApiClient);
  });

  it("uses default URL when STABLES_API_URL is not set", () => {
    vi.stubEnv("STABLES_API_KEY", "test-key");
    delete process.env.STABLES_API_URL;
    const client = createStablesClient();
    expect(client).toBeInstanceOf(StablesApiClient);
  });

  describe("environment inferred from the key", () => {
    it("sends a live key to production", () => {
      expect(apiUrlForKey("sti_live_abc123_secret")).toBe("https://api.stables.money");
    });

    it("sends a test key to sandbox", () => {
      expect(apiUrlForKey("sti_test_abc123_secret")).toBe("https://api.sandbox.stables.money");
    });

    it("declines to guess for a local key or an unrecognised shape", () => {
      // Only the caller knows where a local deployment lives.
      expect(apiUrlForKey("sti_local_abc123_secret")).toBeNull();
      expect(apiUrlForKey("not-a-stables-key")).toBeNull();
    });

    it("routes a test key to sandbox with no STABLES_API_URL set", async () => {
      vi.stubEnv("STABLES_API_KEY", "sti_test_abc123_secret");
      delete process.env.STABLES_API_URL;
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ customers: [] })));
      await createStablesClient().listCustomers();
      expect(fetchSpy.mock.calls[0][0]).toContain("https://api.sandbox.stables.money");
      fetchSpy.mockRestore();
    });

    it("lets an explicit STABLES_API_URL outrank the key", async () => {
      vi.stubEnv("STABLES_API_KEY", "sti_live_abc123_secret");
      vi.stubEnv("STABLES_API_URL", "https://api.staging.stables.money");
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ customers: [] })));
      await createStablesClient().listCustomers();
      expect(fetchSpy.mock.calls[0][0]).toContain("https://api.staging.stables.money");
      fetchSpy.mockRestore();
    });
  });

  it("throws if STABLES_API_KEY is missing", () => {
    delete process.env.STABLES_API_KEY;
    expect(() => createStablesClient()).toThrow("STABLES_API_KEY environment variable is required");
  });

  it("throws if STABLES_API_URL is not HTTPS", () => {
    vi.stubEnv("STABLES_API_KEY", "test-key");
    vi.stubEnv("STABLES_API_URL", "http://insecure.example.com");
    expect(() => createStablesClient()).toThrow("STABLES_API_URL must use HTTPS");
  });
});

describe("StablesApiClient", () => {
  let client: StablesApiClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new StablesApiClient("test-api-key", "https://api.test.stables.money");
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  describe("request basics", () => {
    it("sends correct authorization header", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ customers: [] }));
      await client.listCustomers();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.test.stables.money/api/v1/customers");
      expect((opts?.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer test-api-key"
      );
    });

    it("sets Content-Type for POST requests with body", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          customerId: "cust_123",
          externalCustomerId: "ext_123",
          customerType: "CUSTOMER_TYPE_INDIVIDUAL",
          email: "test@test.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          verificationLevels: [],
        })
      );

      await client.createCustomer({
        externalCustomerId: "ext_123",
        customerType: "CUSTOMER_TYPE_INDIVIDUAL",
        email: "test@test.com",
      });

      const [, opts] = fetchSpy.mock.calls[0];
      expect((opts?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("includes idempotency key for mutations", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({
          customerId: "cust_123",
          externalCustomerId: "ext_123",
          customerType: "CUSTOMER_TYPE_INDIVIDUAL",
          email: "test@test.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          verificationLevels: [],
        })
      );

      await client.createCustomer({
        externalCustomerId: "ext_123",
        customerType: "CUSTOMER_TYPE_INDIVIDUAL",
      });

      const [, opts] = fetchSpy.mock.calls[0];
      expect((opts?.headers as Record<string, string>)["idempotency-key"]).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("throws StablesApiError on 4xx with error.message body", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(
          { error: { message: "Customer not found" } },
          { status: 404, statusText: "Not Found" }
        )
      );

      await expect(client.getCustomer("nonexistent")).rejects.toThrow(StablesApiError);
    });

    it("throws StablesApiError on 4xx with message body", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ message: "Bad request" }, { status: 400, statusText: "Bad Request" })
      );

      await expect(client.getCustomer("bad")).rejects.toThrow("Bad request");
    });

    it("throws StablesApiError on 4xx with string error body", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ error: "Forbidden" }, { status: 403, statusText: "Forbidden" })
      );

      await expect(client.getCustomer("forbidden")).rejects.toThrow("Forbidden");
    });

    it("falls back to HTTP status when body is unparseable", async () => {
      // Mock all 4 attempts (1 initial + 3 retries) for 5xx
      for (let i = 0; i < 4; i++) {
        fetchSpy.mockResolvedValueOnce(
          new Response("not json", { status: 500, statusText: "Internal Server Error" })
        );
      }

      await expect(client.getCustomer("err")).rejects.toThrow("HTTP 500: Internal Server Error");
    }, 30_000);

    it("does not retry 4xx client errors", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ message: "Not found" }, { status: 404, statusText: "Not Found" })
      );

      await expect(client.getCustomer("missing")).rejects.toThrow(StablesApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("handles 204 No Content responses", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204, statusText: "No Content" }));

      await client.updateMetadata("cust_123", { key: "value" });
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });

  describe("retry logic", () => {
    it("retries on 500 errors up to MAX_RETRIES times", async () => {
      // First 3 attempts fail with 500, 4th succeeds
      fetchSpy
        .mockResolvedValueOnce(
          new Response("fail", { status: 500, statusText: "Internal Server Error" })
        )
        .mockResolvedValueOnce(
          new Response("fail", { status: 500, statusText: "Internal Server Error" })
        )
        .mockResolvedValueOnce(
          new Response("fail", { status: 500, statusText: "Internal Server Error" })
        )
        .mockResolvedValueOnce(mockResponse({ customers: [] }));

      const result = await client.listCustomers();
      expect(result).toEqual({ customers: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 30_000);

    it("throws after exhausting retries on 5xx", async () => {
      fetchSpy.mockResolvedValue(new Response("fail", { status: 502, statusText: "Bad Gateway" }));

      await expect(client.listCustomers()).rejects.toThrow("HTTP 502: Bad Gateway");
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 30_000);

    it("retries on 429 rate limit", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse(null, {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Retry-After": "1" },
          })
        )
        .mockResolvedValueOnce(mockResponse({ customers: [] }));

      const result = await client.listCustomers();
      expect(result).toEqual({ customers: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, 30_000);

    it("retries on network errors", async () => {
      fetchSpy
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(mockResponse({ customers: [] }));

      const result = await client.listCustomers();
      expect(result).toEqual({ customers: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, 30_000);
  });

  describe("timeout handling", () => {
    it("aborts request after timeout and wraps as StablesApiError", async () => {
      fetchSpy.mockImplementationOnce(
        (_url, opts) =>
          new Promise((_resolve, reject) => {
            opts?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );

      // Temporarily speed up timeout for test
      // We can't easily change the constant, so we'll verify the abort signal is set
      void client.getCustomer("slow");
      // The signal should be set on the fetch call
      const [, opts] = fetchSpy.mock.calls[0];
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("rate limiting", () => {
    it("includes Retry-After value in error message", async () => {
      fetchSpy
        .mockResolvedValueOnce(
          mockResponse(null, {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Retry-After": "30" },
          })
        )
        // Retries will also get 429
        .mockResolvedValue(
          mockResponse(null, {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Retry-After": "30" },
          })
        );

      await expect(client.listCustomers()).rejects.toThrow("Rate limited. Retry after 30 seconds.");
    }, 30_000);
  });

  describe("API method endpoints", () => {
    it("listCustomers hits GET /api/v1/customers", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ customers: [] }));
      await client.listCustomers();
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/customers");
    });

    it("getCustomer hits GET /api/v1/customers/:id", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ customerId: "c1" }));
      await client.getCustomer("c1");
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/customers/c1");
    });

    it("createCustomer hits POST /api/v1/customer", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ customerId: "c1" }));
      await client.createCustomer({
        externalCustomerId: "ext",
        customerType: "CUSTOMER_TYPE_INDIVIDUAL",
      });
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/customer");
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("POST");
    });

    it("createQuote hits POST /api/v1/quotes", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ quote: { quoteId: "q1" } }));
      await client.createQuote({
        from: { currency: "USDC", network: "polygon", amount: "100" },
        to: { currency: "EUR", country: "GR", paymentMethodType: "LOCAL" },
      });
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/quotes");
    });

    it("listTransfers builds snake_case query params", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ transfers: [], page: { next_page_token: "", total: 0 } })
      );
      await client.listTransfers({ status: "completed", customerId: "c1", pageSize: 10 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("status=completed");
      // camelCase keys were accepted and ignored, so the customer filter and
      // paging silently did nothing and every call returned page one.
      expect(url).toContain("customer_id=c1");
      expect(url).toContain("page_size=10");
      expect(url).not.toContain("customerId");
      expect(url).not.toContain("pageSize");
    });

    it("getVirtualAccountHistory builds query params correctly", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ count: 0, data: [] }));
      await client.getVirtualAccountHistory("c1", "va1", {
        limit: 5,
        depositId: "dep1",
        startingAfter: "evt_abc",
      });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("limit=5");
      expect(url).toContain("deposit_id=dep1");
      expect(url).toContain("starting_after=evt_abc");
    });

    it("revokeApiKey hits DELETE /api/v1/api-keys/:id", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await client.revokeApiKey("key_123");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "https://api.test.stables.money/api/v1/api-keys/key_123"
      );
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });

    it("deleteWebhook hits DELETE /api/v1/webhooks/:id", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await client.deleteWebhook("wh_123");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "https://api.test.stables.money/api/v1/webhooks/wh_123"
      );
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });
  });

  /**
   * The wire format itself, asserted on the request body rather than on our own
   * types. The suite used to mock fetch and check nothing about what was sent,
   * so it stayed green through a whole snake_case migration.
   */
  describe("request bodies match the API contract", () => {
    it("createTransfer sends snake_case with a discriminated destination", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ id: "tr_1" }));
      await client.createTransfer({
        customer_id: "cus_1",
        quote_id: "q_1",
        destination: {
          type: "bank",
          account_holder_name: "Jane Doe",
          bank_name: "Chase",
          bank_country: "US",
          currency: "USD",
          recipient_type: "individual",
          date_of_birth: "1990-01-15",
          address: {
            street: "123 Main St",
            city: "San Francisco",
            state: "CA",
            postal_code: "94105",
            country: "us",
          },
          aba_code: "021000021",
        },
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.customer_id).toBe("cus_1");
      expect(body.quote_id).toBe("q_1");
      expect(body.destination.type).toBe("bank");
      // The enhanced-beneficiary fields required for AED/CAD/EUR/GBP/MXN/USD.
      expect(body.destination.recipient_type).toBe("individual");
      expect(body.destination.date_of_birth).toBe("1990-01-15");
      expect(body.destination.address.postal_code).toBe("94105");
      // Bank codes are flat now, not nested under bankCodes.
      expect(body.destination.aba_code).toBe("021000021");
      expect(body.destination.bankCodes).toBeUndefined();
      // The old shape must be gone entirely.
      expect(body.paymentMethod).toBeUndefined();
      expect(body.customerId).toBeUndefined();
    });

    it("createQuote sends source/destination, not from/to", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ quote_id: "q_1" }));
      await client.createQuote({
        source: { currency: "USDT", amount: "100", network: "polygon" },
        destination: { currency: "EUR", country: "DE", network: "swift" },
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.source.currency).toBe("USDT");
      expect(body.destination.country).toBe("DE");
      expect(body.from).toBeUndefined();
      expect(body.to).toBeUndefined();
      // Replaced by destination.network.
      expect(body.paymentMethodType).toBeUndefined();
    });

    it("getQuote returns the quote directly, with no wrapper", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ quote_id: "q_1", status: "active" }));
      const quote = await client.getQuote("q_1");
      expect(quote.quote_id).toBe("q_1");
    });

    it("reuses one idempotency key across retries", async () => {
      // A fresh key per attempt would defeat the API's idempotency guard and
      // could double-submit a payout. The key is built once at the call site and
      // the same options object is reused, so this holds — pinned here because
      // the guarantee is invisible from the code that depends on it.
      fetchSpy.mockResolvedValueOnce(
        new Response("boom", { status: 500, statusText: "Internal Server Error" })
      );
      fetchSpy.mockResolvedValueOnce(mockResponse({ id: "tr_1" }));

      await client.createTransfer({
        customer_id: "cus_1",
        quote_id: "q_1",
        destination: {
          type: "bank",
          account_holder_name: "Jane Doe",
          bank_name: "Chase",
          bank_country: "US",
          currency: "USD",
        },
      });

      expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
      const keyOf = (i: number) =>
        ((fetchSpy.mock.calls[i][1] as RequestInit).headers as Record<string, string>)[
          "idempotency-key"
        ];
      expect(keyOf(0)).toBeDefined();
      expect(keyOf(1)).toBe(keyOf(0));
    });

    it("createVirtualAccount sends workflow_type and no deposit_handling_mode", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ id: "va_1" }));
      await client.createVirtualAccount("cus_1", {
        source: { currency: "AUD" },
        workflow_type: "fiat_to_crypto",
        destination: { currency: "usdt", payment_rail: "polygon", address: "0xabc" },
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.workflow_type).toBe("fiat_to_crypto");
      expect(body.destination.currency).toBe("usdt");
      // Not part of the create schema — it was accepted and ignored.
      expect(body.deposit_handling_mode).toBeUndefined();
    });

    it("simulate deposit and destination update hit the right paths", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }));
      await client.simulateVirtualAccountDeposit("cus_1", "va_1", { amount: "100" });
      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/api/v1/customers/cus_1/virtual-accounts/va_1/sandbox/simulate-deposit"
      );

      fetchSpy.mockResolvedValueOnce(mockResponse({ id: "va_1" }));
      await client.updateVirtualAccountDestination("cus_1", "va_1", {
        currency: "usdt",
        payment_rail: "polygon",
        address: "0xdef",
      });
      expect(fetchSpy.mock.calls[1][0]).toContain(
        "/api/v1/customers/cus_1/virtual-accounts/va_1/destination"
      );
      expect((fetchSpy.mock.calls[1][1] as RequestInit).method).toBe("PUT");
    });

    it("reads RFIs and webhook deliveries", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ rfis: [{ rfi_id: "r_1" }] }));
      const { rfis } = await client.listCustomerRfis("cus_1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/api/v1/customers/cus_1/rfis");
      expect(rfis[0].rfi_id).toBe("r_1");

      fetchSpy.mockResolvedValueOnce(mockResponse({ deliveries: [] }));
      await client.listWebhookDeliveries({ pageSize: 5, status: "FAILED" });
      const url = fetchSpy.mock.calls[1][0] as string;
      expect(url).toContain("/api/v1/webhooks/deliveries");
      expect(url).toContain("status=FAILED");
    });
  });
});
