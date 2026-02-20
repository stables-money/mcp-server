/**
 * Stables API Client for MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
 */

// Customer Types
export type CustomerType = "CUSTOMER_TYPE_INDIVIDUAL" | "CUSTOMER_TYPE_BUSINESS";

export type VerificationStatus =
  | "VERIFICATION_IN_PROGRESS"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED";

export type VerificationLevel =
  | "KYC_LEVEL_0"
  | "KYC_LEVEL_1"
  | "KYC_LEVEL_2"
  | "BASE_BUSINESS"
  | "INDIVIDUAL_BASE"
  | "BUSINESS_BASE"
  | "INDIVIDUAL_ENHANCED";

export interface VerificationLevelResponse {
  level: VerificationLevel;
  status: VerificationStatus;
}

export interface Entitlement {
  name: string;
  status: "ENTITLEMENT_STATUS_SUBMITTED" | "ENTITLEMENT_STATUS_IN_PROGRESS" | "ENTITLEMENT_STATUS_APPROVED" | "ENTITLEMENT_STATUS_REJECTED";
}

export interface CustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface Customer {
  customerId: string;
  externalCustomerId: string;
  customerType: CustomerType;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  entitlements?: Entitlement[];
  createdAt: string;
  updatedAt: string;
  verificationLevels: VerificationLevelResponse[];
  metadata?: Record<string, string>;
}

export interface CreateCustomerRequest {
  externalCustomerId: string;
  customerType: CustomerType;
  email?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  companyName?: string;
  phone?: string;
  dob?: string;
  nationality?: string;
  address?: CustomerAddress;
  entitlements?: string[];
  metadata?: Record<string, string>;
}

export interface ListCustomersResponse {
  customers: Customer[];
}

// Verification Link Types
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
  customerId: string;
  kycLink: string;
}

// Transfer Types
export type TransferType = "TRANSFER_TYPE_OFFRAMP" | "TRANSFER_TYPE_ONRAMP";

export type TransferStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface BankCodes {
  swiftCode?: string;
  bicCode?: string;
  ifscCode?: string;
  abaCode?: string;
  sortCode?: string;
  branchCode?: string;
  bsbCode?: string;
  bankCode?: string;
  cnaps?: string;
}

export interface BankTransferDetails {
  accountHolderName: string;
  accountNumber?: string;
  iban?: string;
  bankName: string;
  bankCountry: string;
  currency: string;
  accountType?: "savings" | "checking" | "payment";
  branchName?: string;
  bankCodes?: BankCodes;
}

export interface PaymentMethod {
  bankTransfer: BankTransferDetails;
}

export interface CollectionInstructions {
  walletAddress: string;
  currency: string;
  network: string;
  amount: string;
}

export interface Transfer {
  id: string;
  tenantId: string;
  customerId: string;
  quoteId: string;
  type: TransferType;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  collectionInstructions?: CollectionInstructions;
  metadata?: Record<string, string>;
}

export interface CreateTransferRequest {
  customerId: string;
  quoteId: string;
  paymentMethod?: PaymentMethod;
  metadata?: Record<string, string>;
}

export interface ListTransfersResponse {
  transfers: Transfer[];
  page: {
    nextPageToken: string;
    total: number;
  };
}

// Virtual Account Types
export type VirtualAccountStatus = "activated" | "deactivated" | "pending" | "closed";
export type PaymentRail = "arbitrum" | "avalanche_c_chain" | "base" | "celo" | "ethereum" | "optimism" | "polygon" | "solana" | "stellar" | "tron";
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

// Quote Types
export type QuoteStatus = "QUOTE_STATUS_ACTIVE" | "QUOTE_STATUS_EXPIRED" | "QUOTE_STATUS_USED" | "QUOTE_STATUS_CANCELLED";
export type PaymentMethodType = "SWIFT" | "LOCAL";
export type QuoteNetwork = "ethereum" | "polygon" | "polygon-amoy";

export interface CurrencyAmount {
  currency: string;
  amount: string;
  network?: string;
}

export interface FeeBreakdown {
  fxFee: CurrencyAmount;
  integratorFee: CurrencyAmount;
  platformFee: CurrencyAmount;
  paymentMethodFee: CurrencyAmount;
  networkFee?: CurrencyAmount;
  totalFee: CurrencyAmount;
}

export interface Quote {
  quoteId: string;
  from: CurrencyAmount;
  to: {
    currency: string;
    amount: string;
    network?: string;
    paymentMethodType: PaymentMethodType;
  };
  fees: FeeBreakdown;
  exchangeRate: number;
  expiresAt: string;
  createdAt: string;
  status: QuoteStatus;
  metadata?: Record<string, string>;
}

export interface CreateQuoteRequest {
  from: {
    currency: string;
    network: QuoteNetwork;
    amount: string;
  };
  to: {
    currency: string;
    country: string;
    network?: QuoteNetwork;
    paymentMethodType: PaymentMethodType;
  };
  metadata?: Record<string, string>;
}

export interface CreateQuoteResponse {
  quote: Quote;
}

// API Key Types
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

// Webhook Types
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

// API Client
export class StablesApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers as Record<string, string>,
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
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

      throw new Error(errorMessage);
    }

    return response.json();
  }

  private generateIdempotencyKey(): string {
    return crypto.randomUUID();
  }

  // ============ CUSTOMERS ============

  async listCustomers(): Promise<ListCustomersResponse> {
    return this.request<ListCustomersResponse>("/api/v1/customers");
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.request<Customer>(`/api/v1/customers/${customerId}`);
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return this.request<Customer>("/api/v1/customer", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  async updateCustomer(customerId: string, data: Record<string, unknown>): Promise<Customer> {
    return this.request<Customer>(`/api/v1/customer/${customerId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async updateMetadata(customerId: string, metadata: Record<string, string>): Promise<void> {
    await this.request<Record<string, never>>(`/api/v1/customers/${customerId}/metadata`, {
      method: "PUT",
      body: JSON.stringify({ metadata }),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  async generateVerificationLink(
    customerId: string,
    options?: GenerateVerificationLinkRequest
  ): Promise<GenerateVerificationLinkResponse> {
    return this.request<GenerateVerificationLinkResponse>(
      `/api/v1/customer/${customerId}/verification/link`,
      {
        method: "POST",
        body: JSON.stringify(options || {}),
        headers: {
          "idempotency-key": this.generateIdempotencyKey(),
        },
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
    return this.request<ListVirtualAccountsResponse>(
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
    return this.request<ListVirtualAccountsResponse>(
      `/api/v1/customers/${customerId}/virtual-accounts${query ? `?${query}` : ""}`
    );
  }

  async createVirtualAccount(
    customerId: string,
    data: CreateVirtualAccountRequest
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "idempotency-key": this.generateIdempotencyKey(),
        },
      }
    );
  }

  async updateVirtualAccount(
    customerId: string,
    virtualAccountId: string,
    data: { deposit_handling_mode?: DepositHandlingMode }
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
  }

  async deactivateVirtualAccount(
    customerId: string,
    virtualAccountId: string
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/deactivate`,
      {
        method: "POST",
        headers: {
          "idempotency-key": this.generateIdempotencyKey(),
        },
      }
    );
  }

  async reactivateVirtualAccount(
    customerId: string,
    virtualAccountId: string
  ): Promise<VirtualAccount> {
    return this.request<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/reactivate`,
      {
        method: "POST",
        headers: {
          "idempotency-key": this.generateIdempotencyKey(),
        },
      }
    );
  }

  async getVirtualAccountHistory(
    customerId: string,
    virtualAccountId: string,
    params?: { limit?: number; event_type?: string }
  ): Promise<{ count: number; data: VirtualAccountHistoryEvent[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.event_type) searchParams.set("event_type", params.event_type);

    const query = searchParams.toString();
    return this.request<{ count: number; data: VirtualAccountHistoryEvent[] }>(
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
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params?.pageToken) searchParams.set("pageToken", params.pageToken);

    const query = searchParams.toString();
    return this.request<ListTransfersResponse>(
      `/api/v1/transfers${query ? `?${query}` : ""}`
    );
  }

  async getTransfer(transferId: string): Promise<Transfer> {
    return this.request<Transfer>(`/api/v1/transfers/${transferId}`);
  }

  async createTransfer(data: CreateTransferRequest): Promise<Transfer> {
    return this.request<Transfer>("/api/v1/transfer", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  // ============ QUOTES ============

  async createQuote(data: CreateQuoteRequest): Promise<CreateQuoteResponse> {
    return this.request<CreateQuoteResponse>("/api/v1/quotes", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  async getQuote(quoteId: string): Promise<{ quote: Quote }> {
    return this.request<{ quote: Quote }>(`/api/v1/quotes/${quoteId}`);
  }

  // ============ API KEYS ============

  async listApiKeys(params?: { pageSize?: number; pageToken?: string }): Promise<{ apiKeys: ApiKey[] }> {
    const searchParams = new URLSearchParams();
    if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params?.pageToken) searchParams.set("pageToken", params.pageToken);

    const query = searchParams.toString();
    return this.request<{ apiKeys: ApiKey[] }>(
      `/api/v1/api-keys${query ? `?${query}` : ""}`
    );
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>("/api/v1/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  async getApiKey(apiKeyId: string): Promise<{ apiKey: ApiKey }> {
    return this.request<{ apiKey: ApiKey }>(`/api/v1/api-keys/${apiKeyId}`);
  }

  async revokeApiKey(apiKeyId: string): Promise<Record<string, never>> {
    return this.request<Record<string, never>>(`/api/v1/api-keys/${apiKeyId}`, {
      method: "DELETE",
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  // ============ WEBHOOKS ============

  async listWebhooks(): Promise<{ subscriptions: WebhookSubscription[] }> {
    return this.request<{ subscriptions: WebhookSubscription[] }>("/api/v1/webhooks");
  }

  async createWebhook(data: CreateWebhookRequest): Promise<{ subscription: WebhookSubscription }> {
    return this.request<{ subscription: WebhookSubscription }>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "idempotency-key": this.generateIdempotencyKey(),
      },
    });
  }

  async deleteWebhook(subscriptionId: string): Promise<Record<string, never>> {
    return this.request<Record<string, never>>(
      `/api/v1/webhooks/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          "idempotency-key": this.generateIdempotencyKey(),
        },
      }
    );
  }
}

// Create client from environment variables
export function createStablesClient(): StablesApiClient {
  const apiKey = process.env.STABLES_API_KEY;
  const baseUrl = process.env.STABLES_API_URL || "https://api.sandbox.stables.money";

  if (!apiKey) {
    throw new Error("STABLES_API_KEY environment variable is required");
  }

  return new StablesApiClient(apiKey, baseUrl);
}
