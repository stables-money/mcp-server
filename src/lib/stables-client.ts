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
export const ENTITLEMENT_IDS = [
  "base_payout",
  "virtual_account",
  "eur_virtual_account",
  "gbp_virtual_account",
  "usd_virtual_account",
  "aed_local",
] as const;

export type EntitlementId = (typeof ENTITLEMENT_IDS)[number];

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
  source_of_funds?: string;
  source_of_funds_description?: string;
  expected_annual_revenue?: string;
  expected_monthly_payments?: string;
  does_your_business_engage_in_high_risk_activities?: "yes" | "no";
  high_risk_activities?: string[];
  operate_in_prohibited_country?: boolean;
  accept_terms?: boolean;
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
  /** Present only when a page size was sent. */
  page?: { next_page_token: string; total: number };
}

// ============ VERIFICATION LINK TYPES ============

export interface VerificationRedirect {
  success_url?: string;
  reject_url?: string;
  sign_key?: string;
  allowed_query_params?: string[];
}

export interface GenerateVerificationLinkRequest {
  ttl_in_secs?: number;
  redirect?: VerificationRedirect;
  verification_type?:
    | "liveness"
    | "passport"
    | "source_of_wealth"
    | "proof_of_address"
    | "business_edd";
}

export interface GenerateVerificationLinkResponse {
  customer_id: string;
  kyc_link: string;
}

// ============ BALANCE / ENTITLEMENT / WHITELIST TYPES ============

export type BalanceNetwork = "ethereum" | "polygon" | "solana" | "tron";

export interface BalanceResponse {
  balances: {
    currency: string;
    amount: string;
    amount_minor: string;
    available?: string;
    pending?: string;
    network: string;
  }[];
  transfers_enabled: boolean;
}

export interface BalanceWalletResponse {
  status: "not_created" | "creating" | "active" | "failed";
  wallet?: { address: string; network: string; currencies?: string[] } | null;
}

export interface BalanceDeposit {
  id: string;
  amount: string;
  currency: string;
  network: string | null;
  tx_hash: string | null;
  from_address: string | null;
  status: string;
  created_at: string;
}

export interface PendingBalanceDeposit {
  id: string;
  network: string | null;
  currency: string;
  amount: string;
  from_address: string | null;
  tx_hash: string | null;
  reason: "sender_not_whitelisted" | "compliance_review";
}

export interface WhitelistedWallet {
  id: string;
  name: string;
  network: BalanceNetwork;
  address: string;
  status: "pending_review" | "active" | "rejected" | "deactivated" | "archived";
  rejection_reason: string | null;
}

export interface WhitelistedSourceAccount {
  id: number;
  account_name: string | null;
  account_number: string;
  bsb_number: string;
  account_status: "enabled" | "disabled";
}

export interface EntitlementsResponse {
  entitlements: {
    name: string;
    status: string;
    phase?: string;
    requirements?: { submitted?: string[]; missing?: string[] } & Record<string, unknown>;
  }[];
}

/** snake_case paging query for the balance endpoints. */
function pageQuery(params?: Record<string, string | number | undefined>): string {
  const names: Record<string, string> = { pageSize: "page_size", pageToken: "page_token" };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") search.set(names[key] ?? key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
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
  pay_id_type?: "email" | "phone_number" | "abn" | "acn" | "organisation_id";
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
  funding_source?: "fund_transfer" | "prefund_balance";
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

/**
 * `deposit_handling_mode` is deliberately absent — it is not part of the create
 * schema (the server sets it, defaulting to auto_payout) and was being silently
 * ignored. Change it afterwards with updateVirtualAccount.
 */
export interface CreateVirtualAccountRequest {
  source: { currency: string };
  /** Required for fiat_to_crypto, which is the default. */
  destination?: VirtualAccountDestination;
  workflow_type?: "fiat_to_crypto" | "fiat_to_fiat";
  metadata?: Record<string, string>;
}

export interface ListVirtualAccountsResponse {
  count: number;
  data: VirtualAccount[];
}

/**
 * One deposit and its payout. The client previously described these as
 * `{type, amount, currency}`, none of which exist, so every row rendered as
 * "undefined: undefined undefined".
 */
export interface VirtualAccountHistoryEvent {
  id: string;
  virtual_account_id: string;
  deposit_amount?: string;
  deposit_currency?: string;
  deposit_id?: string;
  sender_name?: string;
  sender_reference?: string;
  handling_mode?: string;
  payout_status?: string;
  payout_amount?: string;
  payout_currency?: string;
  payout_network?: string;
  payout_address?: string;
  payout_transaction_hash?: string;
  payout_completed_at?: string;
  platform_fee_amount?: string;
  platform_fee_currency?: string;
  deposited_at?: string;
  created_at?: string;
}

/** The envelope is `{data, has_more}` — there is no `count`. */
export interface VirtualAccountHistoryResponse {
  data: VirtualAccountHistoryEvent[];
  has_more?: boolean;
}

// ============ RFI TYPES ============

/**
 * A request for information: what a customer must supply before a held
 * verification or payout can proceed. Compliance can raise one at any time, so
 * an integration that never reads them will stall without knowing why.
 */
export interface Rfi {
  rfi_id: string;
  type: "verification" | "transaction" | "manual";
  status: RfiStatus;
  customer_id: string;
  /** "customer", or "payment" when the RFI is about one held transfer or deposit. */
  subject: "customer" | "payment";
  kyc_level?: string;
  transaction_reference_id?: string;
  transaction_type?: "transfer" | "virtual_account";
  transfer_id?: string;
  virtual_account_id?: string;
  reasons: { reason_code: string; description: string }[];
  message?: string;
  requirements: RfiRequirement[];
  billable: boolean;
  rejection_reason?: string;
  created_at: string;
  expires_at?: string;
  resolved_at?: string;
}

export type RfiStatus = "open" | "submitted" | "satisfied" | "expired" | "waived" | "rejected";

/**
 * One item an RFI asks for. `type` says how to answer it: `kyc_level` and
 * `kyc_capability` through a verification link (`action.verification_type`),
 * `evidence` through submit_rfi_evidence, and `manual_review` needs nothing.
 */
export interface RfiRequirement {
  requirement_id: string;
  type: "kyc_level" | "kyc_capability" | "manual_review" | "evidence";
  status: "pending" | "submitted" | "satisfied" | "waived";
  required_level?: string;
  required_capability?: string;
  required_evidence?: "source_of_funds" | "ad_hoc";
  label?: string;
  instructions?: string;
  answer_type?: "text" | "document";
  rejection_reason?: string;
  action?: { kind: string; verification_type?: string; form?: string; submit?: string };
}

export interface ListRfisParams {
  status?: RfiStatus[];
  type?: Rfi["type"][];
  customerId?: string;
  transactionReferenceId?: string;
  limit?: number;
  cursor?: string;
}

/** The form an `evidence` requirement asks the customer to fill in, with what was sent so far. */
export interface RfiEvidence {
  rfi_id: string;
  requirement_id: string;
  customer_id: string;
  required_evidence: "source_of_funds" | "ad_hoc";
  status: "pending" | "submitted" | "satisfied" | "waived";
  answerable: boolean;
  rejection_reason?: string;
  form: {
    title?: string;
    description?: string;
    fields?: {
      key: string;
      label: string;
      type: string;
      required: boolean;
      description?: string;
    }[];
    documents?: {
      wire_field: string;
      label: string;
      required: boolean;
      description?: string;
      min_count?: number;
      max_count?: number;
    }[];
  };
  submission?: Record<string, unknown> | null;
}

export interface KycCapabilities {
  customer_id: string;
  capabilities: { capability: string; kyc_level: string; status: string; granted_at: string }[];
}

// ============ TRANSACTION DOCUMENT TYPES ============

/** Documents attach to a transfer or to a payment route deposit. */
export type DocumentOwner = "transfer" | "deposit";

export interface TransactionDocument {
  document_id: string;
  transaction_id: string;
  transaction_type: "transfer" | "payment_route";
  type: "invoice" | "contract" | "other";
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface DocumentDownload {
  url: string;
  file_name: string;
  content_type: string;
  expires_in: number;
}

export interface PayIdRegistration {
  pay_id: string;
  already_registered?: boolean;
  status?: string;
  status_description?: string;
  pay_id_name?: string;
  pay_id_status?: string;
}

// ============ WEBHOOK DELIVERY TYPES ============

export interface WebhookDelivery {
  deliveryId: string;
  subscriptionId?: string | null;
  subscriptionName?: string | null;
  subscriptionUrl?: string | null;
  eventType: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "RETRYING";
  attemptCount: number;
  lastAttemptAt?: string | null;
  nextRetryAt?: string | null;
  responseCode?: number | null;
  createdAt?: string | null;
}

// ============ SANDBOX TYPES ============

export interface SandboxDepositRequest {
  amount: string;
  scenario?: "create_only" | "completed" | "failed";
  external_deposit_id?: string;
  sender_name?: string;
  sender_reference?: string;
  failure_code?: string;
  failure_message?: string;
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

/**
 * Header the hosted server adds to every request it forwards. The API gateway
 * (api-lambda-authoriser) checks it against a shared secret in place of the
 * source-IP allowlist, since a Cloudflare Worker has no fixed egress IP. The
 * caller's API key still authenticates the request in api-service.
 */
export const GATEWAY_SIGNATURE_HEADER = "X-Stables-Mcp-Signature";

/** `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<METHOD>.<path>")>` */
export async function signGatewayRequest(
  secret: string,
  method: string,
  path: string,
  timestampSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${timestampSeconds}.${method.toUpperCase()}.${path}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `t=${timestampSeconds},v1=${hex}`;
}

export interface StablesApiClientOptions {
  /** Shared secret for GATEWAY_SIGNATURE_HEADER; unset means no signature (local use). */
  gatewaySigningSecret?: string;
  /** Sent as User-Agent so API logs can tell MCP traffic apart. */
  userAgent?: string;
}

export class StablesApiClient {
  private apiKey: string;
  private baseUrl: string;
  private options: StablesApiClientOptions;

  constructor(apiKey: string, baseUrl: string, options: StablesApiClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.options = options;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...(this.options.userAgent ? { "User-Agent": this.options.userAgent } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (this.options.gatewaySigningSecret) {
      headers[GATEWAY_SIGNATURE_HEADER] = await signGatewayRequest(
        this.options.gatewaySigningSecret,
        options.method ?? "GET",
        new URL(url).pathname
      );
    }

    // The API refuses a DELETE with no body (415: the gateway gives it a form content
    // type). An empty JSON object passes and is ignored.
    if (options.method === "DELETE" && !options.body) {
      options = { ...options, body: "{}" };
    }

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

  async listCustomers(params?: {
    pageSize?: number;
    pageToken?: string;
  }): Promise<ListCustomersResponse> {
    return this.requestWithRetry<ListCustomersResponse>(`/api/v1/customers${pageQuery(params)}`);
  }

  /** `include` adds normalized verification data and/or document images; larger and slower. */
  async getCustomer(
    customerId: string,
    include?: ("verification-profile" | "doc-images" | "all")[]
  ): Promise<Customer> {
    const query = include?.length ? `?include=${include.join(",")}` : "";
    return this.requestWithRetry<Customer>(`/api/v1/customers/${customerId}${query}`);
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
    startingAfter?: string;
  }): Promise<ListVirtualAccountsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.startingAfter) searchParams.set("starting_after", params.startingAfter);

    const query = searchParams.toString();
    return this.requestWithRetry<ListVirtualAccountsResponse>(
      `/api/v1/virtual-accounts${query ? `?${query}` : ""}`
    );
  }

  async listVirtualAccounts(
    customerId: string,
    params?: { status?: string; limit?: number; startingAfter?: string }
  ): Promise<ListVirtualAccountsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.startingAfter) searchParams.set("starting_after", params.startingAfter);

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
  ): Promise<VirtualAccountHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.depositId) searchParams.set("deposit_id", params.depositId);
    if (params?.startingAfter) searchParams.set("starting_after", params.startingAfter);
    if (params?.endingBefore) searchParams.set("ending_before", params.endingBefore);

    const query = searchParams.toString();
    return this.requestWithRetry<VirtualAccountHistoryResponse>(
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
    network: "swift" | "bank" | "payid",
    destination: BankTransferDestination,
    quoteId?: string
  ): Promise<ValidatePaymentMethodResponse> {
    return this.requestWithRetry<ValidatePaymentMethodResponse>(
      "/api/v1/payment-methods/validate",
      {
        method: "POST",
        body: JSON.stringify({ network, destination, ...(quoteId && { quote_id: quoteId }) }),
      }
    );
  }

  /** Replace the payout wallet on an existing payment route. */
  async updateVirtualAccountDestination(
    customerId: string,
    virtualAccountId: string,
    destination: VirtualAccountDestination
  ): Promise<VirtualAccount> {
    return this.requestWithRetry<VirtualAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/destination`,
      {
        method: "PUT",
        body: JSON.stringify(destination),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  /** Register a PayID for an activated AUD payment route. */
  async registerPayId(customerId: string, virtualAccountId: string): Promise<PayIdRegistration> {
    return this.requestWithRetry<PayIdRegistration>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/payid`,
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  // Supporting documents (invoices, contracts) on a transfer or a payment route deposit.
  // These routes take no Idempotency-Key.

  async addDocument(
    owner: DocumentOwner,
    transactionId: string,
    document: { file_name: string; base64_url: string; type?: TransactionDocument["type"] }
  ): Promise<{ document: TransactionDocument }> {
    return this.requestWithRetry<{ document: TransactionDocument }>(
      `/api/v1/${owner}s/${transactionId}/documents`,
      { method: "POST", body: JSON.stringify(document) }
    );
  }

  async listDocuments(
    owner: DocumentOwner,
    transactionId: string
  ): Promise<{ documents: TransactionDocument[] }> {
    return this.requestWithRetry<{ documents: TransactionDocument[] }>(
      `/api/v1/${owner}s/${transactionId}/documents`
    );
  }

  async getDocumentDownloadUrl(
    owner: DocumentOwner,
    transactionId: string,
    documentId: string
  ): Promise<DocumentDownload> {
    return this.requestWithRetry<DocumentDownload>(
      `/api/v1/${owner}s/${transactionId}/documents/${documentId}/download-url`
    );
  }

  async deleteDocument(
    owner: DocumentOwner,
    transactionId: string,
    documentId: string
  ): Promise<{ deleted: boolean }> {
    return this.requestWithRetry<{ deleted: boolean }>(
      `/api/v1/${owner}s/${transactionId}/documents/${documentId}`,
      { method: "DELETE" }
    );
  }

  /** Compliance requests for information across the organisation; open ones by default. */
  async listRfis(params: ListRfisParams = {}): Promise<{ rfis: Rfi[]; next_cursor?: string }> {
    const query = new URLSearchParams();
    if (params.status?.length) query.set("status", params.status.join(","));
    if (params.type?.length) query.set("type", params.type.join(","));
    if (params.customerId) query.set("customerId", params.customerId);
    if (params.transactionReferenceId)
      query.set("transactionReferenceId", params.transactionReferenceId);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    return this.requestWithRetry<{ rfis: Rfi[]; next_cursor?: string }>(
      `/api/v1/rfis${qs ? `?${qs}` : ""}`
    );
  }

  /** Compliance requests for information against one customer. */
  async listCustomerRfis(customerId: string, status?: RfiStatus): Promise<{ rfis: Rfi[] }> {
    const query = status ? `?status=${status}` : "";
    return this.requestWithRetry<{ rfis: Rfi[] }>(`/api/v1/customers/${customerId}/rfis${query}`);
  }

  async getRfi(rfiId: string): Promise<Rfi> {
    return this.requestWithRetry<Rfi>(`/api/v1/rfis/${rfiId}`);
  }

  /** The form an `evidence` requirement asks for, with the current submission if one was sent. */
  async getRfiEvidence(
    customerId: string,
    rfiId: string,
    requirementId: string
  ): Promise<RfiEvidence> {
    return this.requestWithRetry<RfiEvidence>(
      `/api/v1/customers/${customerId}/rfis/${rfiId}/requirements/${requirementId}/evidence`
    );
  }

  /** Answers and documents for an `evidence` requirement, keyed as its form lists them. */
  async submitRfiEvidence(
    customerId: string,
    rfiId: string,
    requirementId: string,
    answers: Record<string, unknown>
  ): Promise<{ rfi: Rfi }> {
    return this.requestWithRetry<{ rfi: Rfi }>(
      `/api/v1/customers/${customerId}/rfis/${rfiId}/requirements/${requirementId}/evidence`,
      {
        method: "POST",
        body: JSON.stringify(answers),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  /** The verification capabilities a customer holds, such as proof_of_address. */
  async getKycCapabilities(customerId: string): Promise<KycCapabilities> {
    return this.requestWithRetry<KycCapabilities>(
      `/api/v1/customer/${customerId}/kyc-capabilities`
    );
  }

  async listAvailableEntitlements(customerId: string): Promise<Record<string, unknown>> {
    return this.requestWithRetry<Record<string, unknown>>(
      `/api/v1/customers/${customerId}/entitlements/available`
    );
  }

  /**
   * Sandbox only. Drives a deposit through the route or transfer so an agent can
   * reach a terminal state in test, which is otherwise impossible without a real
   * bank payment.
   */
  async simulateVirtualAccountDeposit(
    customerId: string,
    virtualAccountId: string,
    data: SandboxDepositRequest
  ): Promise<Record<string, unknown>> {
    return this.requestWithRetry<Record<string, unknown>>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/sandbox/simulate-deposit`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  async simulateTransferDeposit(
    transferId: string,
    data?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.requestWithRetry<Record<string, unknown>>(
      `/api/v1/transfers/${transferId}/sandbox/simulate-deposit`,
      {
        method: "POST",
        body: JSON.stringify(data ?? {}),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  /** Recent webhook delivery attempts — the first place to look when events go missing. */
  async listWebhookDeliveries(params?: {
    pageSize?: number;
    status?: string;
    eventType?: string;
  }): Promise<{ deliveries: WebhookDelivery[] }> {
    const search = new URLSearchParams();
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.status) search.set("status", params.status);
    if (params?.eventType) search.set("eventType", params.eventType);
    const query = search.toString();
    return this.requestWithRetry<{ deliveries: WebhookDelivery[] }>(
      `/api/v1/webhooks/deliveries${query ? `?${query}` : ""}`
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

  // ============ ONBOARDING LINK ============

  /**
   * Create (or reuse, matched on email) a customer and return a hosted KYC link
   * in one call. Fields supplied for an existing customer are ignored.
   */
  async createCustomerOnboardingLink(
    data: Record<string, unknown>
  ): Promise<{ customer_id: string; kyc_link: string; customer_created: boolean }> {
    return this.requestWithRetry("/api/v1/customer/verification/link", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  // ============ ENTITLEMENTS ============

  async requestEntitlements(
    customerId: string,
    entitlements: string[]
  ): Promise<EntitlementsResponse> {
    return this.requestWithRetry<EntitlementsResponse>(
      `/api/v1/customers/${customerId}/entitlements`,
      {
        method: "POST",
        body: JSON.stringify({ entitlements }),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  async updateEntitlementRequirements(
    customerId: string,
    entitlement: string,
    requirements: Record<string, unknown>
  ): Promise<EntitlementsResponse> {
    return this.requestWithRetry<EntitlementsResponse>(
      `/api/v1/customers/${customerId}/entitlements/${encodeURIComponent(entitlement)}/requirements`,
      {
        method: "PATCH",
        body: JSON.stringify(requirements),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  // ============ PAYMENT ROUTE WHITELISTING (AUD) ============

  async listRouteWhitelist(
    customerId: string,
    virtualAccountId: string
  ): Promise<{ count: number; data: WhitelistedSourceAccount[] }> {
    return this.requestWithRetry(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/whitelist-accounts`
    );
  }

  async addRouteWhitelistAccount(
    customerId: string,
    virtualAccountId: string,
    sourceAccount: {
      account_number: string;
      bsb_number: string;
      account_status?: "enabled" | "disabled";
    }
  ): Promise<WhitelistedSourceAccount> {
    return this.requestWithRetry<WhitelistedSourceAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/whitelist-accounts`,
      {
        method: "POST",
        body: JSON.stringify({ source_account: sourceAccount }),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  async updateRouteWhitelistAccount(
    customerId: string,
    virtualAccountId: string,
    sourceAccountId: number,
    data: { account_number: string; bsb_number: string; account_status: "enabled" | "disabled" }
  ): Promise<WhitelistedSourceAccount> {
    return this.requestWithRetry<WhitelistedSourceAccount>(
      `/api/v1/customers/${customerId}/virtual-accounts/${virtualAccountId}/whitelist-accounts/${sourceAccountId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "idempotency-key": this.generateIdempotencyKey() },
      }
    );
  }

  // ============ BALANCES ============
  // The API paths say "prefund"; the docs and dashboard call it the balance.

  async getBalance(): Promise<BalanceResponse> {
    return this.requestWithRetry<BalanceResponse>("/api/v1/prefund/balance");
  }

  async getBalanceWallet(network?: BalanceNetwork): Promise<BalanceWalletResponse> {
    return this.requestWithRetry<BalanceWalletResponse>(
      `/api/v1/prefund/wallet${network ? `?network=${network}` : ""}`
    );
  }

  /** Asynchronous: answers `creating` first; safe to repeat while in flight. */
  async createBalanceWallet(network: BalanceNetwork): Promise<BalanceWalletResponse> {
    return this.requestWithRetry<BalanceWalletResponse>("/api/v1/prefund/wallet", {
      method: "POST",
      body: JSON.stringify({ network }),
      headers: { "idempotency-key": this.generateIdempotencyKey() },
    });
  }

  async listBalanceActivity(params?: {
    network?: BalanceNetwork;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{ data: BalanceDeposit[]; next_page_token?: string | null }> {
    return this.requestWithRetry(`/api/v1/prefund/activity${pageQuery(params)}`);
  }

  async listPendingBalanceDeposits(): Promise<{ data: PendingBalanceDeposit[] }> {
    return this.requestWithRetry("/api/v1/prefund/deposits/pending");
  }

  async listWhitelistedWallets(params?: {
    network?: BalanceNetwork;
    status?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<{ data: WhitelistedWallet[]; next_page_token?: string | null }> {
    return this.requestWithRetry(`/api/v1/prefund/whitelisted-wallets${pageQuery(params)}`);
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
