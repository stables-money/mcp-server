/**
 * Stables API Client for MCP Server
 * Updated to match official Stables API documentation
 * Docs: https://docs.stables.money
 */

// Customer Types
export type CustomerType =
  | "CUSTOMER_TYPE_INDIVIDUAL"
  | "CUSTOMER_TYPE_BUSINESS"
  | "CUSTOMER_TYPE_TRUST"
  | "CUSTOMER_TYPE_NONPROFIT"
  | "CUSTOMER_TYPE_DAO";

export type VerificationStatus =
  | "VERIFICATION_PENDING"
  | "VERIFICATION_IN_PROGRESS"
  | "VERIFICATION_IN_REVIEW"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED"
  | "VERIFICATION_NEEDS_INFO";

export interface VerificationLevel {
  id: string;
  customerId: string;
  kycLevel: string;
  status: VerificationStatus;
  createdAt: string;
  updatedAt: string;
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
  externalCustomerId?: string;
  customerType: CustomerType;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  businessName?: string;
  dob?: string;
  nationality?: string;
  address?: CustomerAddress;
  createdAt: string;
  updatedAt: string;
  verificationLevels: VerificationLevel[];
  metadata?: Record<string, string>;
}

export interface CreateCustomerRequest {
  externalCustomerId?: string;
  customerType: CustomerType;
  email: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  businessName?: string;
  phone?: string;
  dob?: string;
  nationality?: string;
  address?: CustomerAddress;
  entitlements?: string[];
  metadata?: Record<string, string>;
}

export interface ListCustomersResponse {
  customers: Customer[];
  page: {
    nextPageToken: string;
    total: number;
  };
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

export interface BankTransferDetails {
  accountHolderName: string;
  iban?: string;
  bankName?: string;
  bankCountry?: string;
  currency?: string;
  bankCodes?: {
    swiftCode?: string;
    routingNumber?: string;
    sortCode?: string;
  };
  accountNumber?: string;
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
export type Network = "arbitrum" | "avalanche_c_chain" | "base" | "ethereum" | "optimism" | "polygon" | "solana" | "stellar" | "tron";
export type Stablecoin = "usdc" | "usdt" | "dai" | "pyusd" | "eurc";
export type DepositHandlingMode = "auto_payout" | "hold" | "manual";

export interface VirtualAccount {
  id: string;
  status: VirtualAccountStatus;
  customer_id: string;
  created_at: string;
  source_deposit_instructions: {
    currency: string;
    payment_rails: string[];
    bank_name?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
  };
  deposit_handling_mode: DepositHandlingMode;
  active_destination: {
    id: string;
    currency: string;
    network: string;
    address: string;
  } | null;
}

export interface CreateVirtualAccountRequest {
  source: {
    currency: string;
  };
  deposit_handling_mode?: DepositHandlingMode;
  initial_destination?: {
    label?: string;
    currency: Stablecoin;
    network: Network;
    address: string;
  };
}

export interface ListVirtualAccountsResponse {
  count: number;
  data: VirtualAccount[];
}

// Quote Types
export type QuoteStatus = "QUOTE_STATUS_ACTIVE" | "QUOTE_STATUS_EXPIRED" | "QUOTE_STATUS_USED";
export type PaymentMethodType = "SWIFT" | "LOCAL";

export interface Quote {
  quoteId: string;
  from: {
    currency: string;
    amount: string;
    network?: string;
  };
  to: {
    currency: string;
    amount: string;
    paymentMethodType?: PaymentMethodType;
  };
  fees: {
    totalFee: { currency: string; amount: string };
  };
  exchangeRate: number;
  expiresAt: string;
  createdAt: string;
  status: QuoteStatus;
}

export interface CreateQuoteRequest {
  customerId: string;
  from: {
    currency: string;
    amount: string;
    network?: string;
  };
  to: {
    currency: string;
    country?: string;
    paymentMethodType?: PaymentMethodType;
  };
}

export interface CreateQuoteResponse {
  quote: Quote;
}

// API Key Types
export interface ApiKey {
  id: string;
  apiKeyId?: string;
  name: string;
  prefix: string;
  active?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastUsedAt?: string;
  metadata?: Record<string, string>;
}

export interface CreateApiKeyRequest {
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateApiKeyResponse {
  apiKey: {
    apiKeyId: string;
    tenantId: string;
    name: string;
    prefix: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
  plaintextKey: string;
}

// Webhook Types (matching docs: eventTypes, name, secret, subscription wrapper)
export interface WebhookSubscription {
  subscriptionId: string;
  name: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  eventTypes: string[];
  secret?: string;
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

  async listCustomers(params?: { pageSize?: number; pageToken?: string }): Promise<ListCustomersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params?.pageToken) searchParams.set("pageToken", params.pageToken);

    const query = searchParams.toString();
    return this.request<ListCustomersResponse>(
      `/api/v1/customers${query ? `?${query}` : ""}`
    );
  }

  async getCustomer(customerId: string): Promise<Customer> {
    return this.request<Customer>(`/api/v1/customers/${customerId}`);
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return this.request<Customer>("/api/v1/customer", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Idempotency-Key": this.generateIdempotencyKey(),
      },
    });
  }

  async generateVerificationLink(
    customerId: string,
    options?: { verificationType?: "KYC" | "KYB"; kycLevel?: string }
  ): Promise<{ customerId: string; kycLink: string }> {
    return this.request<{ customerId: string; kycLink: string }>(
      `/api/v1/customers/${customerId}/verification/link`,
      {
        method: "POST",
        body: JSON.stringify(options || {}),
        headers: {
          "Idempotency-Key": this.generateIdempotencyKey(),
        },
      }
    );
  }

  // ============ VIRTUAL ACCOUNTS ============

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
          "Idempotency-Key": this.generateIdempotencyKey(),
        },
      }
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
        "Idempotency-Key": this.generateIdempotencyKey(),
      },
    });
  }

  // ============ QUOTES ============

  async createQuote(data: CreateQuoteRequest): Promise<CreateQuoteResponse> {
    return this.request<CreateQuoteResponse>("/api/v1/quotes", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Idempotency-Key": this.generateIdempotencyKey(),
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
        "Idempotency-Key": this.generateIdempotencyKey(),
      },
    });
  }

  async getApiKey(apiKeyId: string): Promise<ApiKey> {
    return this.request<ApiKey>(`/api/v1/api-keys/${apiKeyId}`);
  }

  async revokeApiKey(apiKeyId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/v1/api-keys/${apiKeyId}`, {
      method: "DELETE",
      headers: {
        "Idempotency-Key": this.generateIdempotencyKey(),
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
        "Idempotency-Key": this.generateIdempotencyKey(),
      },
    });
  }

  async deleteWebhook(subscriptionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/api/v1/webhooks/${subscriptionId}`,
      {
        method: "DELETE",
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
