/**
 * Stables API Client for MCP Server
 * Synced with OpenAPI spec from https://api.stables.money/docs
 */

import { randomUUID } from "node:crypto";

// ============ CUSTOM ERROR ============

export class StablesApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly errorBody?: unknown
  ) {
    super(message);
    this.name = "StablesApiError";
  }
}

// ============ CUSTOMER TYPES ============

export type CustomerType = "individual" | "business";

export type VerificationStatus = "in_progress" | "approved" | "rejected" | "not_started";

export type VerificationLevel =
  | "individual_base"
  | "individual_enhanced"
  | "business_base"
  | "base_business";

export interface VerificationLevelResponse {
  level: VerificationLevel;
  status: VerificationStatus;
  sub_status?: string[];
  details?: unknown[];
}

/** The five feature entitlements the API accepts. */
export type EntitlementId =
  | "base_payout"
  | "virtual_account"
  | "eur_virtual_account"
  | "usd_virtual_account"
  | "aed_local";

export interface Entitlement {
  name: string;
  status: "submitted" | "pending" | "in_progress" | "approved" | "rejected";
}

export interface CustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
}

export interface Customer {
  customer_id: string;
  external_customer_id?: string;
  customer_type: CustomerType;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  status?: string;
  compliance_lock?: boolean;
  entitlements?: Entitlement[];
  created_at: string;
  updated_at: string;
  verification_levels?: VerificationLevelResponse[];
  metadata?: Record<string, string>;
}

export interface CreateIndividualCustomerRequest {
  customer_type: "individual";
  /** Required — the API rejects a customer without one. */
  email: string;
  external_customer_id?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  phone?: string;
  dob?: string;
  nationality?: string;
  tax_id_number?: string;
  address?: CustomerAddress;
  entitlements?: EntitlementId[];
  metadata?: Record<string, string>;
}

export interface CreateBusinessCustomerRequest {
  customer_type: "business";
  email: string;
  company_name: string;
  external_customer_id?: string;
  phone?: string;
  country?: string;
  registration_number?: string;
  legal_address?: CustomerAddress;
  postal_address?: CustomerAddress;
  incorporated_on?: string;
  type?: string;
  tax_id?: string;
  registration_location?: string;
  website?: string;
  alternative_names?: string[];
  describe_business?: string;
  conduct_money_services?: boolean;
  describe_money_services?: string;
  describe_compliance_controls?: string;
  account_purpose?: string;
  account_purpose_other?: string;
  is_your_business_a_dao?: boolean;
  industry_selection?: string;
  main_source_of_funds?: string;
  source_of_funds?: string;
  source_of_funds_description?: string;
  expected_annual_revenue?: string;
  expected_monthly_payments?: string;
  does_your_business_engage_in_high_risk_activities?: "yes" | "no";
  high_risk_activities?: string[];
  operate_in_prohibited_country?: boolean;
  accept_terms?: boolean;
  how_did_you_come_across_stables?: string;
  entitlements?: EntitlementId[];
  metadata?: Record<string, string>;
}

export type CreateCustomerRequest = CreateIndividualCustomerRequest | CreateBusinessCustomerRequest;

/**
 * Every field optional, so an unknown key is not an error — it is simply
 * dropped. Sending camelCase here parsed to an empty object and returned 200
 * having changed nothing.
 */
export interface UpdateCustomerRequest {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  dob?: string;
  nationality?: string;
  company_name?: string;
  entitlements?: EntitlementId[];
  metadata?: Record<string, string>;
}

export interface ListCustomersResponse {
  customers: Customer[];
}

// ============ VERIFICATION LINK TYPES ============

export interface VerificationRedirect {
  successUrl?: string;
  rejectUrl?: string;
  signKey?: string;
  allowedQueryParams?: string[];
}

export interface GenerateVerificationLinkRequest {
  ttlInSecs?: number;
  redirect?: VerificationRedirect;
}

export interface GenerateVerificationLinkResponse {
  customer_id: string;
  kyc_link: string;
}

// ============ TRANSFER TYPES ============

// The wire is snake_case for transfers, customers, quotes and virtual accounts;
// only api-keys and webhooks are camelCase. Types below mirror the wire exactly
// so nothing has to be remembered at the call site.

export type TransferType = "offramp" | "onramp";

export type TransferStatus =
  | "created"
  | "compliance_hold"
  | "awaiting_funds_collection"
  | "funds_collected"
  | "in_progress"
  | "payment_submitted"
  | "payment_processed"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "unknown";

/** ISO 3166-1 alpha-2, lowercase, per AddressApiSchema. */
export interface BeneficiaryAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/**
 * Bank payout destination. Bank codes are flat here — the nested `bankCodes`
 * object the API used to take is gone.
 */
export interface BankTransferDestination {
  type: "bank";
  account_holder_name: string;
  bank_name: string;
  bank_country: string;
  currency: string;
  /**
   * Required for payouts in AED, CAD, EUR, GBP, MXN and USD, together with
   * `address`, and `date_of_birth` when this is "individual".
   */
  recipient_type?: "individual" | "business";
  date_of_birth?: string;
  address?: BeneficiaryAddress;
  account_number?: string;
  iban?: string;
  pay_id?: string;
  pay_id_type?: "email" | "phone" | "abn" | "org_id";
  account_type?: "savings" | "checking" | "payment";
  branch_name?: string;
  swift_code?: string;
  bic_code?: string;
  ifsc_code?: string;
  aba_code?: string;
  sort_code?: string;
  branch_code?: string;
  bsb_code?: string;
  bank_code?: string;
  cnaps?: string;
  name_in_local_language?: string;
  national_identification_number?: string;
}

export interface PaymentMethodValidationError {
  field?: string;
  message: string;
  code: "UNSUPPORTED_CURRENCY" | "UNSUPPORTED_PAYMENT_METHOD" | "INVALID_FIELDS";
}

export interface ValidatePaymentMethodResponse {
  valid: boolean;
  errors?: PaymentMethodValidationError[];
}

export interface CryptoTransferDestination {
  type: "crypto";
  currency: string;
  network: string;
  address: string;
}

export type TransferDestination = BankTransferDestination | CryptoTransferDestination;

/** Where the customer sends funds for an offramp. Was `collectionInstructions`. */
export interface SourceDepositInstructions {
  wallet_address?: string;
  currency?: string;
  network?: string;
  amount?: string;
  [key: string]: unknown;
}

export interface Transfer {
  id: string;
  tenant_id: string;
  customer_id: string;
  quote_id: string;
  type: TransferType;
  status: TransferStatus;
  origin?: "api" | "otc";
  created_at: string;
  updated_at: string;
  source_deposit_instructions?: SourceDepositInstructions;
  destination?: TransferDestination;
  fees?: Record<string, unknown>;
  exchange_rate?: string;
  metadata?: Record<string, string>;
}

export interface CreateTransferRequest {
  customer_id: string;
  quote_id: string;
  destination: TransferDestination;
  purpose_code?: string;
  metadata?: Record<string, string>;
}

export interface ListTransfersResponse {
  transfers: Transfer[];
  page: {
    next_page_token: string;
    total: number;
  };
}

// ============ VIRTUAL ACCOUNT TYPES ============

export type VirtualAccountStatus = "activated" | "deactivated" | "pending" | "closed";
export type PaymentRail =
  | "arbitrum"
  | "avalanche_c_chain"
  | "base"
  | "celo"
  | "ethereum"
  | "optimism"
  | "polygon"
  | "solana"
  | "stellar"
  | "tron";
export type Stablecoin = "usdc" | "usdt" | "dai" | "pyusd" | "eurc";
export type DepositHandlingMode = "auto_payout" | "hold" | "manual";

export interface VirtualAccountDestination {
  currency: Stablecoin;
  payment_rail: PaymentRail;
  address: string;
  memo?: string;
}

export interface VirtualAccountDepositInstructions {
  currency: string;
  payment_rails: string[];
  bank_name?: string;
  bank_address?: string;
  bank_beneficiary_name?: string;
  bank_beneficiary_address?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  iban?: string;
  bic?: string;
  pix_key?: string;
  clabe?: string;
  account_holder_name?: string;
}

export interface VirtualAccount {
  id: string;
  status: VirtualAccountStatus;
  customer_id: string;
  developer_fee_percent?: string;
  created_at: string;
  source_deposit_instructions: VirtualAccountDepositInstructions;
  deposit_handling_mode: DepositHandlingMode;
  destination: VirtualAccountDestination | null;
  held_balance: { amount: string; currency: string } | null;
  deposit_stats?: {
    total_deposit_count: number;
    total_deposit_amount: string;
    last_deposit_at: string | null;
  };
}

export interface CreateVirtualAccountRequest {
  source: { currency: string };
  deposit_handling_mode?: DepositHandlingMode;
  destination?: VirtualAccountDestination;
  metadata?: Record<string, string>;
}

export interface ListVirtualAccountsResponse {
  count: number;
  data: VirtualAccount[];
}

export interface VirtualAccountHistoryEvent {
  id: string;
  type: string;
  customer_id: string;
  virtual_account_id: string;
  amount: string;
  currency: string;
  deposit_id?: string;
  created_at: string;
}

// ============ QUOTE TYPES ============

export type QuoteStatus = "active" | "expired" | "used" | "cancelled" | "preview";

/**
 * Live blockchain networks. The client used to allow only ethereum and polygon,
 * which blocked six networks the platform supports.
 */
export type QuoteNetwork =
  | "arbitrum"
  | "avalanche"
  | "base"
  | "ethereum"
  | "optimism"
  | "polygon"
  | "solana"
  | "tron";

export interface CurrencyAmount {
  currency: string;
  amount: string;
  network?: string;
}

export interface FeeBreakdown {
  fx_fee?: CurrencyAmount;
  integrator_fee?: CurrencyAmount;
  platform_fee?: CurrencyAmount;
  payment_method_fee?: CurrencyAmount;
  network_fee?: CurrencyAmount;
  total_fee: CurrencyAmount;
}

export interface Quote {
  quote_id: string;
  source: CurrencyAmount;
  destination: CurrencyAmount;
  fees: FeeBreakdown;
  exchange_rate: number;
  expires_at: string;
  created_at: string;
  status: QuoteStatus;
  metadata?: Record<string, string>;
}

export interface CreateQuoteRequest {
  source: {
    currency: string;
    /** Required for offramp (crypto source); omitted for onramp (fiat source). */
    network?: string;
    amount: string;
  };
  destination: {
    currency: string;
    /** Required for offramp. */
    country?: string;
    /** Offramp: payment network (swift/bank). Onramp: blockchain network. */
    network?: string;
    /** Required for onramp. */
    address?: string;
  };
  /** Price without persisting the quote. Returns status "preview". */
  preview?: boolean;
  metadata?: Record<string, string>;
}

/**
 * The quote endpoints return the quote directly. They used to wrap it in
 * `{ quote }`, and reading the wrapper gave undefined and then a TypeError on
 * the first field access.
 */
export type CreateQuoteResponse = Quote;

// ============ API KEY TYPES ============

export interface ApiKey {
  apiKeyId: string;
  tenantId: string;
  name: string;
  prefix: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, string>;
}

export interface CreateApiKeyRequest {
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  plaintextKey: string;
}

// ============ WEBHOOK TYPES ============

export interface WebhookSubscription {
  subscriptionId: string;
  name: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  eventTypes: string[];
  secret?: string;
  metadata?: Record<string, string>;
}

// ============ API CLIENT ============

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export class StablesApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitSecs = retryAfter ? parseInt(retryAfter, 10) : 60;
          throw new StablesApiError(
            `Rate limited. Retry after ${waitSecs} seconds.`,
            429,
            endpoint
          );
        }

        const errorBody = await response.json().catch(() => null);
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        if (errorBody) {
          if (errorBody.error?.message) {
            errorMessage = errorBody.error.message;
          } else if (errorBody.message) {
            errorMessage = errorBody.message;
          } else if (typeof errorBody.error === "string") {
            errorMessage = errorBody.error;
          }
        }

        throw new StablesApiError(errorMessage, response.status, endpoint, errorBody);
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof StablesApiError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new StablesApiError(
          `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          0,
          endpoint
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async requestWithRetry<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry client errors (except 429 rate limits)
        if (error instanceof StablesApiError) {
          if (
            error.statusCode >= 400 &&
            error.statusCode < 500 &&
            !RETRYABLE_STATUS_CODES.has(error.statusCode)
          ) {
            throw error;
          }
        }

        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          const jitter = Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        }
      }
    }

    throw lastError;
  }

  private generateIdempotencyKey(): string {
    return randomUUID();
  }

  // ============ CUSTOMERS ============

  async listCustomers(): Promise<ListCustomersResponse> {
    return this.requestWithRetry<ListCustomersResponse>("/api/v1/customers");
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.requestWithRetry<Customer>(`/api/v1/customers/${customerId}`);
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return this.requestWithRetry<Customer>("/api/v1/customer", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async updateCustomer(customerId: string, data: UpdateCustomerRequest): Promise<Customer> {
    return this.requestWithRetry<Customer>(`/api/v1/customer/${customerId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async updateMetadata(customerId: string, metadata: Record<string, string>): Promise<void> {
    await this.requestWithRetry<Record<string, never>>(`/api/v1/customers/${customerId}/metadata`, {
      method: "PUT",
      body: JSON.stringify({ metadata }),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async generateVerificationLink(
    customerId: string,
    options?: GenerateVerificationLinkRequest
  ): Promise<GenerateVerificationLinkResponse> {
    return this.requestWithRetry<GenerateVerificationLinkResponse>(
      `/api/v1/customer/${customerId}/verification/link`,
      {
        method: "POST",
        body: JSON.stringify(options || {}),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  // ============ VIRTUAL ACCOUNTS ============

  async listAllVirtualAccounts(params?: {
    status?: string;
    limit?: number;
  }): Promise<ListVirtualAccountsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.requestWithRetry<ListVirtualAccountsResponse>(
      `/api/v1/virtual-accounts${query ? `?${query}` : ""}`
    );
  }

  async listVirtualAccounts(
    customerId: string,
    params?: { status?: string; limit?: number }
  ): Promise<ListVirtualAccountsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.requestWithRetry<ListVirtualAccountsResponse>(
      `/api/v1/customers/${customerId}/virtual-accounts${query ? `?${query}` : ""}`
    );
  }

  async createVirtualAccount(
    customerId: string,
    data: CreateVirtualAccountRequest
  ): Promise<VirtualAccount> {
    return this.requestWithRetry<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  async updateVirtualAccount(
    customerId: string,
    virtualAccountId: string,
    data: { deposit_handling_mode?: DepositHandlingMode }
  ): Promise<VirtualAccount> {
    return this.requestWithRetry<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
  }

  // deactivate/reactivate are deliberately absent: those routes exist only on
  // the dashboard surface, which needs a dashboard session, so an API key gets
  // a 404. There is nothing on /api/v1 to mirror.

  async getVirtualAccountHistory(
    customerId: string,
    virtualAccountId: string,
    params?: {
      limit?: number;
      depositId?: string;
      startingAfter?: string;
      endingBefore?: string;
    }
  ): Promise<{ count: number; data: VirtualAccountHistoryEvent[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.depositId) searchParams.set("deposit_id", params.depositId);
    if (params?.startingAfter) searchParams.set("starting_after", params.startingAfter);
    if (params?.endingBefore) searchParams.set("ending_before", params.endingBefore);

    const query = searchParams.toString();
    return this.requestWithRetry<{ count: number; data: VirtualAccountHistoryEvent[] }>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/history${query ? `?${query}` : ""}`
    );
  }

  // ============ TRANSFERS ============

  async listTransfers(params?: {
    status?: string;
    type?: string;
    customerId?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<ListTransfersResponse> {
    // Query keys are snake_case. Sending camelCase did not error — the unknown
    // keys were simply dropped, so the customer filter and paging silently did
    // nothing and every call returned page one.
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.customerId) searchParams.set("customer_id", params.customerId);
    if (params?.pageSize) searchParams.set("page_size", params.pageSize.toString());
    if (params?.pageToken) searchParams.set("page_token", params.pageToken);

    const query = searchParams.toString();
    return this.requestWithRetry<ListTransfersResponse>(
      `/api/v1/transfers${query ? `?${query}` : ""}`
    );
  }

  async getTransfer(transferId: string): Promise<Transfer> {
    return this.requestWithRetry<Transfer>(`/api/v1/transfers/${transferId}`);
  }

  async createTransfer(data: CreateTransferRequest): Promise<Transfer> {
    return this.requestWithRetry<Transfer>("/api/v1/transfer", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  // ============ QUOTES ============

  async createQuote(data: CreateQuoteRequest): Promise<CreateQuoteResponse> {
    return this.requestWithRetry<CreateQuoteResponse>("/api/v1/quotes", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async getQuote(quoteId: string): Promise<Quote> {
    return this.requestWithRetry<Quote>(`/api/v1/quotes/${quoteId}`);
  }

  // ============ API KEYS ============

  async listApiKeys(params?: {
    pageSize?: number;
    pageToken?: string;
  }): Promise<{ apiKeys: ApiKey[] }> {
    const searchParams = new URLSearchParams();
    if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params?.pageToken) searchParams.set("pageToken", params.pageToken);

    const query = searchParams.toString();
    return this.requestWithRetry<{ apiKeys: ApiKey[] }>(
      `/api/v1/api-keys${query ? `?${query}` : ""}`
    );
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return this.requestWithRetry<CreateApiKeyResponse>("/api/v1/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async getApiKey(apiKeyId: string): Promise<{ apiKey: ApiKey }> {
    return this.requestWithRetry<{ apiKey: ApiKey }>(`/api/v1/api-keys/${apiKeyId}`);
  }

  async revokeApiKey(apiKeyId: string): Promise<Record<string, never>> {
    return this.requestWithRetry<Record<string, never>>(`/api/v1/api-keys/${apiKeyId}`, {
      method: "DELETE",
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  // ============ WEBHOOKS ============

  /**
   * Check payout details against the per-currency rules without creating
   * anything. Always answers 200 — the outcome is in the body — so an agent can
   * discover what a corridor demands before spending a short-lived quote.
   */
  async validatePaymentMethod(
    network: string,
    destination: BankTransferDestination
  ): Promise<ValidatePaymentMethodResponse> {
    return this.requestWithRetry<ValidatePaymentMethodResponse>(
      "/api/v1/payment-methods/validate",
      {
        method: "POST",
        body: JSON.stringify({ network, destination }),
      }
    );
  }

  async listWebhooks(): Promise<{ subscriptions: WebhookSubscription[] }> {
    return this.requestWithRetry<{ subscriptions: WebhookSubscription[] }>("/api/v1/webhooks");
  }

  async createWebhook(data: CreateWebhookRequest): Promise<{ subscription: WebhookSubscription }> {
    return this.requestWithRetry<{ subscription: WebhookSubscription }>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async deleteWebhook(subscriptionId: string): Promise<Record<string, never>> {
    return this.requestWithRetry<Record<string, never>>(`/api/v1/webhooks/${subscriptionId}`, {
      method: "DELETE",
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }
}

const PRODUCTION_API_URL = "https://api.stables.money";
const SANDBOX_API_URL = "https://api.sandbox.stables.money";

/**
 * Which environment a key belongs to, read from the key itself.
 *
 * Stables keys are `sti_<env>_<prefix>_<secret>` with env one of local, test or
 * live, and the api service refuses a key whose segment does not match the
 * deployment it arrives at. So the key already decides the environment, and a
 * default base URL is only ever a guess at something we can read.
 *
 * Guessing had a cost in both directions: the code defaulted to production while
 * the README promised sandbox, so a test key with no STABLES_API_URL set failed
 * authentication against production and read as "my key is invalid" when the key
 * was fine.
 */
export function apiUrlForKey(apiKey: string): string | null {
  const env = apiKey.split("_")[1];
  if (env === "live") return PRODUCTION_API_URL;
  if (env === "test") return SANDBOX_API_URL;
  // "local" points at a deployment only the caller knows about, and anything
  // else is not a key shape we recognise.
  return null;
}

// Create client from environment variables
export function createStablesClient(): StablesApiClient {
  const apiKey = process.env.STABLES_API_KEY;

  if (!apiKey) {
    throw new Error("STABLES_API_KEY environment variable is required");
  }

  // An explicit URL always wins: it is the only way to reach staging, dev or a
  // local deployment, and the caller stating an environment outranks inference.
  const baseUrl = process.env.STABLES_API_URL || apiUrlForKey(apiKey) || PRODUCTION_API_URL;

  if (!baseUrl.startsWith("https://")) {
    throw new Error("STABLES_API_URL must use HTTPS");
  }

  return new StablesApiClient(apiKey, baseUrl);
}
