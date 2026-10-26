/**
 * What every tool may do, in one place.
 *
 * - `read` tools only read. They are labelled read-only, so MCP clients run
 *   them without asking.
 * - `write` tools change something in the account, and some move money.
 *   They are labelled destructive, so clients such as Claude ask the person
 *   to confirm each call, and an OAuth connection can only use them when the
 *   person granted "make changes" (scope `stables:write`).
 * - `admin` tools manage API keys. An agent connected through OAuth never
 *   gets them: it could otherwise mint itself credentials outside the grant.
 *   A caller authenticating with its own API key keeps them.
 *
 * Every registered tool must appear here; createStablesMcpServer refuses to
 * start otherwise, so a new tool cannot ship unlabelled.
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type ToolAccess = "read" | "write" | "admin";

interface ToolPolicy {
  access: ToolAccess;
  title: string;
  /** Repeating the same call has no further effect (gets, updates, deletes). */
  idempotent?: boolean;
  /** Reaches beyond the Stables account: pays out to a third party, calls a URL. */
  openWorld?: boolean;
}

const read = (title: string): ToolPolicy => ({ access: "read", title, idempotent: true });
const write = (title: string, extra: Partial<ToolPolicy> = {}): ToolPolicy => ({
  access: "write",
  title,
  ...extra,
});
const admin = (title: string): ToolPolicy => ({ access: "admin", title });

export const TOOL_POLICY: Record<string, ToolPolicy> = {
  // Customers
  list_customers: read("List customers"),
  get_customer: read("Get customer"),
  create_customer: write("Create customer"),
  update_customer: write("Update customer", { idempotent: true }),
  update_customer_metadata: write("Update customer metadata", { idempotent: true }),
  create_customer_onboarding_link: write("Create customer onboarding link"),
  get_verification_link: write("Create verification link"),

  // Quotes and transfers
  create_quote: write("Create quote"),
  get_quote: read("Get quote"),
  validate_payment_method: read("Validate payment method"),
  create_transfer: write("Create transfer (moves money)", { openWorld: true }),
  get_transfer: read("Get transfer"),
  list_transfers: read("List transfers"),

  // Saved beneficiaries
  list_beneficiaries: read("List saved beneficiaries"),
  get_beneficiary: read("Get saved beneficiary"),
  create_beneficiary: write("Save beneficiary", { idempotent: true }),
  archive_beneficiary: write("Archive saved beneficiary", { idempotent: true }),

  // Payment routes (virtual accounts)
  create_virtual_account: write("Create payment route"),
  list_virtual_accounts: read("List payment routes"),
  update_virtual_account: write("Update payment route", { idempotent: true }),
  update_route_destination: write("Change payment route destination", { idempotent: true }),
  get_virtual_account_history: read("Get payment route history"),
  list_route_whitelist: read("List payment route allowed senders"),
  add_route_whitelist_account: write("Add payment route allowed sender"),
  update_route_whitelist_account: write("Update payment route allowed sender", {
    idempotent: true,
  }),
  register_route_payid: write("Register PayID on payment route"),

  // Balances
  get_balance: read("Get balance"),
  get_balance_wallet: read("Get balance wallet"),
  create_balance_wallet: write("Create balance wallet"),
  list_balance_activity: read("List balance activity"),
  list_pending_balance_deposits: read("List pending balance deposits"),
  list_whitelisted_wallets: read("List allowed wallets"),

  // Entitlements and compliance
  list_available_entitlements: read("List available entitlements"),
  request_entitlements: write("Request entitlements"),
  submit_entitlement_requirements: write("Submit entitlement requirements"),
  list_rfis: read("List information requests"),
  list_customer_rfis: read("List customer information requests"),
  get_rfi: read("Get information request"),
  get_rfi_evidence_form: read("Get information request form"),
  submit_rfi_evidence: write("Submit information request evidence"),
  get_kyc_capabilities: read("Get KYC capabilities"),

  // Documents
  add_document: write("Add document"),
  list_documents: read("List documents"),
  get_document_download_url: read("Get document download link"),
  delete_document: write("Delete document", { idempotent: true }),

  // Webhooks
  create_webhook: write("Create webhook", { openWorld: true }),
  list_webhooks: read("List webhooks"),
  delete_webhook: write("Delete webhook", { idempotent: true }),
  list_webhook_deliveries: read("List webhook deliveries"),

  // API keys
  list_api_keys: read("List API keys"),
  get_api_key: read("Get API key"),
  create_api_key: admin("Create API key"),
  revoke_api_key: admin("Revoke API key"),

  // Sandbox
  simulate_route_deposit: write("Simulate payment route deposit (sandbox)"),
  simulate_transfer_deposit: write("Simulate transfer deposit (sandbox)"),
};

/**
 * MCP annotations for a tool. Reads are read-only; every write is marked
 * destructive so clients confirm it with the person, which is the
 * human-in-the-loop step money-moving tools need.
 */
export function annotationsFor(policy: ToolPolicy): ToolAnnotations {
  const readOnly = policy.access === "read";
  return {
    title: policy.title,
    readOnlyHint: readOnly,
    destructiveHint: !readOnly,
    idempotentHint: readOnly || policy.idempotent === true,
    openWorldHint: policy.openWorld === true,
  };
}

export function accessOf(toolName: string): ToolAccess | undefined {
  return TOOL_POLICY[toolName]?.access;
}

/** What a connection may call: write implies read; admin implies write. */
export interface ToolGrant {
  read: boolean;
  write: boolean;
  admin: boolean;
}

export const FULL_ACCESS: ToolGrant = { read: true, write: true, admin: true };

export function allows(grant: ToolGrant, access: ToolAccess): boolean {
  return grant[access];
}
