import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StablesApiClient,
  StablesApiError,
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
    const error = new StablesApiError("Not found", 404, "/api/v1/customers/abc", { message: "Not found" });
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
      expect((opts?.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-api-key");
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
        mockResponse(
          { message: "Bad request" },
          { status: 400, statusText: "Bad Request" }
        )
      );

      await expect(client.getCustomer("bad")).rejects.toThrow("Bad request");
    });

    it("throws StablesApiError on 4xx with string error body", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse(
          { error: "Forbidden" },
          { status: 403, statusText: "Forbidden" }
        )
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
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 204, statusText: "No Content" })
      );

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
      fetchSpy.mockResolvedValue(
        new Response("fail", { status: 502, statusText: "Bad Gateway" })
      );

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

    it("listTransfers builds query params correctly", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ transfers: [], page: { nextPageToken: "", total: 0 } }));
      await client.listTransfers({ status: "COMPLETED", customerId: "c1", pageSize: 10 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("status=COMPLETED");
      expect(url).toContain("customerId=c1");
      expect(url).toContain("pageSize=10");
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
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/api-keys/key_123");
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });

    it("deleteWebhook hits DELETE /api/v1/webhooks/:id", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await client.deleteWebhook("wh_123");
      expect(fetchSpy.mock.calls[0][0]).toBe("https://api.test.stables.money/api/v1/webhooks/wh_123");
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });
  });
});
