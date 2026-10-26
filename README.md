# Stables MCP Server

An MCP (Model Context Protocol) server that exposes the Stables fiat-to-crypto API to AI agents. This allows AI assistants like Claude, ChatGPT, Cursor, Codex, and other MCP-compatible clients to manage customers, create USDC and USDT quotes, execute approved transfers, and handle virtual accounts programmatically.

Use it to build stablecoin payment workflows for AI agents and agentic commerce: payouts, virtual account deposits, treasury movement, fiat off-ramping, and webhook reconciliation.

## What is MCP?

MCP (Model Context Protocol) is an open standard that provides a standardized way to connect AI applications to external tools and data sources. Think of it like a "USB-C port for AI" - any AI that supports MCP can use any MCP server.

## Features

This MCP server provides 55 tools across 12 categories, one for every operation documented on [docs.stables.money](https://docs.stables.money)(a contract test checks this, see below):

### Customer Management
- `create_customer` - Create individual or business customers
- `create_customer_onboarding_link` - Create a customer and a hosted verification link in one call
- `get_customer` - Get customer details and verification status
- `list_customers` - List all customers
- `get_verification_link` - Generate KYC verification links
- `update_customer` - Update customer details and entitlements
- `update_customer_metadata` - Update customer metadata key-value pairs

### Entitlements
- `list_available_entitlements` - Products and rails a customer can still apply for
- `request_entitlements` - Apply for entitlements (e.g. `aed_local`) for an existing customer
- `submit_entitlement_requirements` - Send the extra verification Stables asks for

### Compliance requests (RFIs)
- `list_rfis` - The organisation's RFIs: what compliance needs before it releases a held payment or verification
- `list_customer_rfis` - One customer's RFIs
- `get_rfi` - One RFI, its requirements and how to answer each
- `get_rfi_evidence_form` - The form an `evidence` requirement asks for
- `submit_rfi_evidence` - Send the answers and documents for an `evidence` requirement
- `get_kyc_capabilities` - Verification capabilities a customer holds

### Documents
- `add_document` - Attach an invoice, contract or other document to a transfer or a deposit
- `list_documents` - Documents on a transfer or a deposit
- `get_document_download_url` - Short-lived download link for a document
- `delete_document` - Remove a document

### Quotes
- `create_quote` - Get exchange rate quotes (USDC/USDT to fiat)
- `get_quote` - Check quote status and details

### Transfers
- `validate_payment_method` - Check payout details against a corridor's rules before transferring
- `create_transfer` - Execute a transfer using an active quote, paid by deposit or from your balance
- `get_transfer` - Check transfer status
- `list_transfers` - List transfers with filters

### Saved Beneficiaries
- `list_beneficiaries` - Saved recipients and bank accounts, to pay by id with `create_transfer`
- `get_beneficiary` - One beneficiary's details and whether it still passes today's payout rules
- `create_beneficiary` - Save a recipient and bank account (validated like a transfer)
- `archive_beneficiary` - Archive a beneficiary so it can no longer be paid

### Virtual Accounts
- `create_virtual_account` - Create virtual bank accounts for fiat deposits
- `list_virtual_accounts` - List virtual accounts for a customer, or across all customers
- `update_virtual_account` - Update virtual account settings
- `register_route_payid` - Register a PayID on an AUD payment route
- `get_virtual_account_history` - Get deposits and their payouts for a payment route
- `update_route_destination` - Change the payout wallet on an existing route
- `list_route_whitelist` / `add_route_whitelist_account` / `update_route_whitelist_account` - Source-account whitelisting for AUD routes

### Balances
- `get_balance` - Your organisation's balance per asset and network
- `get_balance_wallet` / `create_balance_wallet` - The deposit wallet that tops up the balance
- `list_balance_activity` - Deposits credited to the balance
- `list_pending_balance_deposits` - Deposits held before crediting, and why
- `list_whitelisted_wallets` - Wallets allowed to fund the balance

### Sandbox
- `simulate_route_deposit` - Simulate a fiat deposit into a payment route (sandbox only)
- `simulate_transfer_deposit` - Simulate the inbound crypto an off-ramp transfer awaits (sandbox only)

### API Keys
- `create_api_key` - Create a new API key
- `list_api_keys` - List all API keys
- `get_api_key` - Get API key details
- `revoke_api_key` - Revoke an API key

### Webhooks
- `create_webhook` - Subscribe to events via webhook
- `list_webhooks` - List all webhook subscriptions
- `delete_webhook` - Delete a webhook subscription
- `list_webhook_deliveries` - Recent delivery attempts, status codes and retry state

## Hosted server (recommended)

The server runs as a hosted service, so there is nothing to install. Point your MCP client at:

```
https://mcp.stables.money/mcp
```

and either send your Stables API key as a bearer token or sign in with OAuth. The key you get during onboarding is all you need: a `sti_test_…` key reaches sandbox, a `sti_live_…` key reaches production and moves real money. Clients that can't hold a key (Claude.ai, ChatGPT) sign in instead; see below.

### Claude Code

```bash
claude mcp add --transport http stables https://mcp.stables.money/mcp --header "Authorization: Bearer ${STABLES_API_KEY}"
```

### Cursor, VS Code, Windsurf and other clients with a `url` field

```json
{
  "mcpServers": {
    "stables": {
      "url": "https://mcp.stables.money/mcp",
      "headers": {
        "Authorization": "Bearer sti_test_..."
      }
    }
  }
}
```

### Codex

```toml
[mcp_servers.stables]
url = "https://mcp.stables.money/mcp"
bearer_token_env_var = "STABLES_API_KEY"
```

### Claude.ai, ChatGPT and other clients that sign in with OAuth

Add `https://mcp.stables.money/mcp` as a custom connector with no key. The client discovers the server's OAuth endpoints, registers itself, and sends you to a Stables page that asks two things: whether to connect sandbox or production, and permission for that client. You then sign in with your Stables dashboard account (and pick an organisation if you belong to several).

You choose **Read only** (the default) or **Read and make changes**; with read only, the agent can look but every tool that changes something is refused until you reconnect and allow changes. Agents connected this way can never create or revoke API keys. Every tool is labelled read-only or destructive, so clients such as Claude ask you before each change. Auth0 asks for your credentials (and a second factor) every time (an existing browser session is never reused for an agent connection) and, when you belong to several organisations, which one to use. On success the server creates an API key in that organisation, named after the client and the account that signed in (for example `Claude via MCP (you@company.com)`), and uses it for every call the client makes. Revoke it any time under Developer → API keys in the dashboard, which disconnects the client. Nothing else is stored: the sign-in token is used once to create the key and then dropped.

- **Claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector, URL `https://mcp.stables.money/mcp`, leave the OAuth client fields on their defaults.
- **ChatGPT:** Settings → Connectors → Create (developer mode), MCP server URL `https://mcp.stables.money/mcp`, authentication OAuth.
- **Claude Code without a key:** `claude mcp add --transport http stables https://mcp.stables.money/mcp`, then `/mcp` to sign in.

The OAuth endpoints are standard: `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`, `/authorize`, `/oauth/token`, `/oauth/register`. Client ID Metadata Documents and dynamic registration are both accepted; PKCE (S256) is required.

## Running locally

The same server also runs as a local process over stdio, which is what `npx stables-mcp-server` does. Use this for a `sti_local_…` key against your own deployment, or when your client cannot reach the internet.

### Installation

```bash
# Install from npm
npm install -g stables-mcp-server

# Or clone and build from source
git clone https://github.com/stables-money/mcp-server.git
cd mcp-server
npm install
npm run build
```

### Configuration

The server requires the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `STABLES_API_KEY` | Yes | Your Stables API key |
| `STABLES_API_URL` | No | API base URL. Defaults to the environment your key belongs to (see below). Must use HTTPS. |

### Which environment you're talking to

Stables keys carry their environment: `sti_test_…` is a sandbox key, `sti_live_…`
is a production key, and the API refuses a key that arrives at the wrong
environment. So you don't have to set a URL — leave `STABLES_API_URL` unset and
the key decides:

| Your key | Where requests go |
|----------|-------------------|
| `sti_test_…` | `https://api.sandbox.stables.money` |
| `sti_live_…` | `https://api.stables.money` — **real money** |
| `sti_local_…` or anything else | production, unless you set `STABLES_API_URL` |

Setting `STABLES_API_URL` always wins, which is how you reach staging, dev or a
local deployment.

**Start with a sandbox key.** An agent holding a live key can move real money on
your behalf; see [agent safety](https://docs.stables.money/get-started/getting-started/quickstart/building-with-ai/agent-safety).

### Usage

#### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stables": {
      "command": "npx",
      "args": ["stables-mcp-server"],
      "env": {
        "STABLES_API_KEY": "your-api-key",
        "STABLES_API_URL": "https://api.sandbox.stables.money"
      }
    }
  }
}
```

Then restart Claude Desktop.

#### With Cursor, Codex, ChatGPT, or another MCP client

Use the same command and environment variables in any MCP-compatible client:

```json
{
  "mcpServers": {
    "stables": {
      "command": "npx",
      "args": ["stables-mcp-server"],
      "env": {
        "STABLES_API_KEY": "your-api-key",
        "STABLES_API_URL": "https://api.sandbox.stables.money"
      }
    }
  }
}
```

## Agent safety

Stables is financial infrastructure. Agents should create quotes, prepare payment objects, and reconcile webhooks, but should require explicit human approval before creating transfers or other money movement. Check customer KYC/KYB status and entitlements before transactional actions, and treat sanctions, unsupported jurisdiction, verification, or compliance failures as hard stops.

### With MCP Inspector (for testing)

```bash
# Set environment variables
export STABLES_API_KEY=your-api-key
export STABLES_API_URL=https://api.sandbox.stables.money

# Run the inspector
npm run inspect
```

### Direct Execution

```bash
STABLES_API_KEY=your-api-key node build/index.js
```

## Example Conversations

### Creating a customer and getting a quote

**User:** "Create a customer for john@example.com and get a quote to convert 1000 USDT to EUR"

**AI (using MCP tools):**
1. Calls `create_customer` with email and type
2. Calls `create_quote` with source USDT + network, destination EUR + country, and `destinationNetwork` (`swift` or `bank`)
3. Returns customer details and quote information

### Checking transfer status

**User:** "What's the status of all my pending transfers?"

**AI (using MCP tools):**
1. Calls `list_transfers` with `status=created` or `status=in_progress` (statuses are lowercase)
2. Returns a formatted list of in-flight transfers

### Setting up auto-payout

**User:** "Create a payment route for customer abc123 that pays AUD deposits out to my Polygon USDT wallet 0x..."

**AI (using MCP tools):**
1. Calls `create_virtual_account` with the customer ID, AUD source currency, and the Polygon destination (the payout address is mandatory)
2. Returns the deposit instructions to share with the customer

### Paying out to a European beneficiary

**User:** "Pay 500 EUR to this German bank account"

**AI (using MCP tools):**
1. Collects the extra beneficiary details EUR requires — `recipientType`, a full address, and `dateOfBirth` for individuals — before doing anything else
2. Calls `create_quote`, then `create_transfer` once a human approves

## Operating the hosted server

The hosted server is the Cloudflare Worker in `src/worker.ts` (`wrangler.toml`). It needs:

- `OAUTH_KV`: a KV namespace for OAuth clients, grants and tokens. Tokens and secrets are stored as hashes; a grant's API key is encrypted with a key only that grant's token can unwrap.
- Vars `MCP_PUBLIC_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`: the public origin, the Auth0 custom domain, and the "Stables MCP" regular-web application (callback `https://mcp.stables.money/callback`).
- Secret `AUTH0_CLIENT_SECRET`: that application's secret.
- Secret `MCP_GATEWAY_SIGNING_SECRET`: shared with the API gateway's IP authoriser. The Worker has no fixed egress IP, so it signs each forwarded request (`X-Stables-Mcp-Signature`), and production accepts the signature in place of the source-IP check. Without it, production calls through the hosted server are rejected by the gateway; sandbox is unaffected.

```bash
wrangler secret put AUTH0_CLIENT_SECRET
wrangler secret put MCP_GATEWAY_SIGNING_SECRET
```

Without `OAUTH_KV` the Worker runs bearer-key only, which is how the unit tests exercise it.

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Test with MCP Inspector
npm run inspect
```

## Project Structure

```
stables-mcp-server/
├── src/
│   ├── index.ts              # Main entry point
│   ├── lib/
│   │   ├── stables-client.ts # Stables API client (with retries, timeouts)
│   │   └── stables-client.test.ts
│   └── tools/
│       ├── customers.ts      # Customer management tools (7)
│       ├── entitlements.ts   # Entitlement tools (3)
│       ├── compliance.ts     # RFI and KYC capability tools (6)
│       ├── documents.ts      # Transfer and deposit document tools (4)
│       ├── quotes.ts         # Quote tools (2)
│       ├── transfers.ts      # Transfer tools (4)
│       ├── beneficiaries.ts  # Saved beneficiary tools (4)
│       ├── virtual-accounts.ts # Payment route tools (9)
│       ├── balances.ts       # Balance tools (6)
│       ├── api-keys.ts       # API key tools (4)
│       ├── webhooks.ts       # Webhook tools (3)
│       └── sandbox.ts        # Sandbox deposit simulation (2)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── README.md
```

## API Reference

### Customer Tools

#### create_customer
Create a new customer for KYC and transfers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Customer's email |
| customerType | "individual" \| "business" | Yes | Type of customer |
| firstName | string | No | First name (for individuals) |
| lastName | string | No | Last name (for individuals) |
| companyName | string | No | Company name (for businesses) |
| entitlements | string[] | No | Entitlements to request (e.g., ["base_payout", "virtual_account"]) |

#### get_customer
Get customer details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |

#### list_customers
List all customers for the authenticated tenant. No parameters required.

#### get_verification_link
Generate a KYC verification link.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| ttlInSecs | number | No | Link expiry in seconds (default: 1800) |
| successUrl | string | No | Redirect URL after successful verification |
| rejectUrl | string | No | Redirect URL after rejected verification |

#### update_customer
Update customer details or entitlements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| email | string | No | Updated email |
| phone | string | No | Updated phone |
| firstName | string | No | Updated first name |
| lastName | string | No | Updated last name |
| entitlements | string[] | No | Updated entitlements |

#### update_customer_metadata
Update customer metadata key-value pairs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| metadata | object | Yes | Key-value pairs to set |

### Quote Tools

#### create_quote
Get a quote for currency exchange (crypto to fiat).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromCurrency | "USDC" \| "USDT" | Yes | Source cryptocurrency |
| fromAmount | string | Yes | Amount to convert |
| fromNetwork | "ethereum" \| "polygon" \| "polygon-amoy" | Yes | Blockchain network |
| toCurrency | string | Yes | Destination currency (e.g., "EUR") |
| toCountry | string | Yes | Destination country code (e.g., "GR") |
| paymentMethodType | "SWIFT" \| "LOCAL" | Yes | Payment method for payout |

#### get_quote
Get quote details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| quoteId | string | Yes | Quote ID |

### Transfer Tools

#### create_transfer
Execute a transfer from a quote.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| quoteId | string | Yes | Quote ID to execute |
| accountHolderName | string | No | Bank account holder name |
| iban | string | No | IBAN |
| accountNumber | string | No | Bank account number |
| bankName | string | No | Bank name |
| bankCountry | string | No | Bank country code |
| bankCurrency | string | No | Payout currency |
| accountType | "savings" \| "checking" \| "payment" | No | Account type |
| swiftCode | string | No | SWIFT/BIC code |
| routingNumber | string | No | ABA routing number (US) |
| sortCode | string | No | Sort code (UK) |
| ifscCode | string | No | IFSC code (India) |
| bsbCode | string | No | BSB code (Australia) |

#### get_transfer
Get transfer status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| transferId | string | Yes | Transfer ID |

#### list_transfers
List transfers with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status |
| type | string | No | Filter by type |
| customerId | string | No | Filter by customer |
| pageSize | number | No | Results per page |
| pageToken | string | No | Pagination token |

### Virtual Account Tools

#### create_virtual_account
Create a virtual bank account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| sourceCurrency | string | Yes | Currency (e.g., "USD") |
| depositHandlingMode | string | No | "auto_payout", "hold", or "manual" |
| destinationAddress | string | No | Crypto wallet address |
| destinationPaymentRail | string | No | Blockchain network |
| destinationCurrency | string | No | Stablecoin (default: "usdc") |

#### list_virtual_accounts
List virtual accounts for a customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| status | string | No | Filter by status |
| limit | number | No | Max results |

#### update_virtual_account
Update virtual account settings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| virtualAccountId | string | Yes | Virtual account ID |
| depositHandlingMode | string | Yes | New deposit handling mode |

#### get_virtual_account_history
Get activity history for a virtual account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| virtualAccountId | string | Yes | Virtual account ID |
| limit | number | No | Max events to return |
| eventType | string | No | Filter by event type |

### API Key Tools

#### create_api_key
Create a new API key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Descriptive name for the key |
| metadata | object | No | Optional metadata |

#### list_api_keys
List all API keys.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pageSize | number | No | Results per page |
| pageToken | string | No | Pagination token |

#### get_api_key
Get API key details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| apiKeyId | string | Yes | API key ID |

#### revoke_api_key
Revoke an API key (permanent).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| apiKeyId | string | Yes | API key ID |

### Webhook Tools

#### create_webhook
Subscribe to events via webhook.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Webhook name |
| url | string | Yes | HTTPS endpoint URL |
| eventTypes | string[] | Yes | Events to subscribe to |
| secret | string | No | HMAC-SHA256 signing secret |

Available event types:
- `WEBHOOK_EVENT_TYPE_CUSTOMER_CREATED`
- `WEBHOOK_EVENT_TYPE_CUSTOMER_UPDATED`
- `WEBHOOK_EVENT_TYPE_KYC_STATUS_CHANGED`
- `WEBHOOK_EVENT_TYPE_PAYMENT_CREATED`
- `WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED`
- `WEBHOOK_EVENT_TYPE_QUOTE_CREATED`
- `WEBHOOK_EVENT_TYPE_QUOTE_EXPIRED`
- `WEBHOOK_EVENT_TYPE_VA_DEPOSIT_RECEIVED`
- `WEBHOOK_EVENT_TYPE_VA_PAYOUT_COMPLETED`
- `WEBHOOK_EVENT_TYPE_VA_PAYOUT_FAILED`
- `WEBHOOK_EVENT_TYPE_ALL`

#### list_webhooks
List all webhook subscriptions. No parameters required.

#### delete_webhook
Delete a webhook subscription.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| webhookId | string | Yes | Webhook subscription ID |

## Security

- API keys are only read from environment variables
- HTTPS required for API URL (enforced at startup)
- No debug logging to stderr (would corrupt MCP STDIO transport)
- All inputs are validated with Zod schemas
- Request timeouts (30s) prevent hung connections
- Automatic retries with exponential backoff for transient failures

## License

MIT

## Links

- [Stables API Documentation](https://docs.stables.money)
- [npm Package](https://www.npmjs.com/package/stables-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
