# AI Agent Integration (MCP)

Connect AI assistants like Claude, ChatGPT, and others to the Stables API using the Model Context Protocol (MCP). This enables AI agents to create customers, execute transfers, manage webhooks, and more - all through natural conversation.

## What is MCP?

MCP (Model Context Protocol) is an open standard that provides a standardized way to connect AI applications to external tools and data sources. Think of it like a USB-C port for AI - any AI that supports MCP can use any MCP server.

The Stables MCP Server exposes 18 tools that let AI agents interact with the full Stables API programmatically.

---

## Quick Start

### Prerequisites

- Node.js 18 or later
- A Stables API key ([get one here](https://docs.stables.money/get-started/getting-started/quickstart-1))
- Claude Desktop (or any MCP-compatible AI client)

### 1. Install the MCP Server

```bash
git clone https://github.com/your-org/stables-mcp-server.git
cd stables-mcp-server
npm install
npm run build
```

### 2. Configure Claude Desktop

Add the following to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "stables": {
      "command": "node",
      "args": ["/path/to/stables-mcp-server/build/index.js"],
      "env": {
        "STABLES_API_KEY": "your-api-key",
        "STABLES_API_URL": "https://api.sandbox.stables.money"
      }
    }
  }
}
```

### 3. Restart and Test

1. Quit Claude Desktop completely (Cmd+Q on macOS)
2. Reopen Claude Desktop
3. Start a new chat and try: **"List my Stables customers"**

---

## Available Tools

### Customer Management

#### create\_customer

Create a new customer for KYC verification and transfers. Include entitlements like `base_payout` to enable transactions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Customer's email address |
| `customerType` | `"individual"` \| `"business"` | Yes | Type of customer |
| `firstName` | string | No | First name (required for individuals) |
| `lastName` | string | No | Last name (required for individuals) |
| `middleName` | string | No | Middle name |
| `businessName` | string | No | Business name (required for businesses) |
| `externalCustomerId` | string | No | Your own reference ID (auto-generated if not provided) |
| `phone` | string | No | Phone with country code (e.g., `+14155552671`) |
| `dob` | string | No | Date of birth (`YYYY-MM-DD`) |
| `nationality` | string | No | Two-letter country code (e.g., `US`) |
| `entitlements` | string[] | No | Entitlements to request (e.g., `["base_payout"]`) |
| `addressLine1` | string | No | Street address line 1 |
| `addressLine2` | string | No | Street address line 2 |
| `addressCity` | string | No | City |
| `addressState` | string | No | State or region |
| `addressPostalCode` | string | No | Postal/ZIP code |
| `addressCountry` | string | No | Two-letter country code |

#### get\_customer

Get details about a specific customer including their verification status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID to look up |

#### list\_customers

List all customers with optional pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageSize` | number | No | Number of customers per page (default: 20) |
| `pageToken` | string | No | Token for the next page of results |

#### get\_verification\_link

Generate a KYC verification link for a customer. The customer must complete verification before they can make transfers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID |
| `verificationType` | `"KYC"` \| `"KYB"` | No | KYC for individuals, KYB for businesses |

---

### Quotes

#### create\_quote

Get a quote for currency exchange. Quotes show the exchange rate, fees, and amount the customer will receive. **Quotes expire after 30 seconds.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID |
| `fromCurrency` | string | Yes | Source currency (e.g., `USDC`, `USD`, `EUR`) |
| `fromAmount` | string | Yes | Amount to convert (e.g., `125.75`) |
| `toCurrency` | string | Yes | Destination currency (e.g., `EUR`, `USDC`) |
| `toCountry` | string | No | Destination country code (e.g., `GR`, `US`) |
| `fromNetwork` | string | No | Blockchain network (e.g., `polygon`, `ethereum`) |
| `paymentMethodType` | `"SWIFT"` \| `"LOCAL"` | No | `SWIFT` for international, `LOCAL` for domestic |

#### get\_quote

Get details about an existing quote including its current status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `quoteId` | string | Yes | The quote ID to look up |

---

### Transfers

#### create\_transfer

Execute a transfer using an active quote. For off-ramp (crypto to fiat), include bank transfer details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID |
| `quoteId` | string | Yes | The quote ID to execute |
| `accountHolderName` | string | No | Bank account holder's name (required for off-ramp) |
| `iban` | string | No | IBAN for the destination bank account |
| `accountNumber` | string | No | Bank account number (if not using IBAN) |
| `bankName` | string | No | Name of the destination bank |
| `bankCountry` | string | No | Two-letter country code of the bank |
| `bankCurrency` | string | No | Currency for the bank payout (e.g., `EUR`) |
| `swiftCode` | string | No | SWIFT/BIC code for international transfers |
| `routingNumber` | string | No | Routing number (US bank transfers) |
| `sortCode` | string | No | Sort code (UK bank transfers) |
| `metadata` | object | No | Optional metadata |

#### get\_transfer

Get the current status and details of a transfer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transferId` | string | Yes | The transfer ID to look up |

#### list\_transfers

List transfers with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED` |
| `type` | string | No | `TRANSFER_TYPE_ONRAMP` or `TRANSFER_TYPE_OFFRAMP` |
| `customerId` | string | No | Filter by customer ID |
| `pageSize` | number | No | Results per page (default: 20) |
| `pageToken` | string | No | Pagination token |

---

### Virtual Accounts

#### create\_virtual\_account

Create a virtual bank account for a customer to receive fiat deposits. Deposits can automatically convert to crypto and payout to a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID |
| `sourceCurrency` | string | Yes | Currency for the account (e.g., `USD`, `EUR`) |
| `depositHandlingMode` | string | No | `auto_payout`, `hold`, or `manual` |
| `destinationAddress` | string | No | Crypto wallet address for auto-payout |
| `destinationNetwork` | string | No | Blockchain network (`polygon`, `ethereum`, `solana`, etc.) |
| `destinationCurrency` | string | No | Stablecoin to receive (`usdc`, `usdt`, `dai`, `pyusd`, `eurc`) |

#### list\_virtual\_accounts

List all virtual accounts for a customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | The customer ID |
| `status` | string | No | `activated`, `deactivated`, `pending`, `closed` |
| `limit` | number | No | Maximum number of accounts to return |

---

### API Key Management

#### create\_api\_key

Create a new API key. **The secret key is only shown once on creation - save it immediately.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Descriptive name (e.g., `Production Bot`) |
| `metadata` | object | No | Optional metadata |

#### list\_api\_keys

List all API keys for the current account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageSize` | number | No | Keys per page |
| `pageToken` | string | No | Pagination token |

#### get\_api\_key

Get details about a specific API key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKeyId` | string | Yes | The API key ID |

#### revoke\_api\_key

Revoke an API key. **This permanently disables the key and cannot be undone.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKeyId` | string | Yes | The API key ID to revoke |

---

### Webhooks

#### create\_webhook

Subscribe to Stables events. You'll receive POST requests to your URL when events occur.

**Available event types:**
- `WEBHOOK_EVENT_TYPE_CUSTOMER_CREATED`
- `WEBHOOK_EVENT_TYPE_KYC_STATUS_CHANGED`
- `WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Descriptive name for this webhook |
| `url` | string | Yes | HTTPS URL to receive webhook POST requests |
| `eventTypes` | string[] | Yes | Event types to subscribe to |
| `secret` | string | No | Signing secret for HMAC-SHA256 verification |

#### list\_webhooks

List all webhook subscriptions. No parameters required.

#### delete\_webhook

Delete a webhook subscription.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `webhookId` | string | Yes | The webhook subscription ID to delete |

---

## Example Workflows

### Onboard a Customer

> **You:** "Create a customer for john@example.com with base_payout entitlement"

The AI agent will:
1. Call `create_customer` with email, type, and entitlements
2. Return the customer ID and verification status
3. Suggest getting a verification link if KYC is needed

> **You:** "Get a verification link for that customer"

The AI agent will:
1. Call `get_verification_link` with the customer ID
2. Return a link to share with the customer

### Execute a Transfer

> **You:** "Get a quote for 500 USDC to EUR via SWIFT for customer abc123"

The AI agent will:
1. Call `create_quote` with the currency details
2. Show the exchange rate, fees, and amount the customer will receive
3. Note that the quote expires in 30 seconds

> **You:** "Execute that transfer to IBAN GR1234567890 at Alpha Bank"

The AI agent will:
1. Call `create_transfer` with the quote ID and bank details
2. Return the transfer ID, status, and collection instructions
3. Show the wallet address where crypto should be sent

### Monitor Transfers

> **You:** "Show me all pending transfers"

The AI agent will:
1. Call `list_transfers` with status filter
2. Return a formatted list of all pending transfers

### Set Up Webhook Notifications

> **You:** "Set up a webhook to notify me when payments complete"

The AI agent will:
1. Call `create_webhook` with your URL and `WEBHOOK_EVENT_TYPE_PAYMENT_STATUS_CHANGED`
2. Return the subscription ID and confirmation

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STABLES_API_KEY` | Yes | - | Your Stables API key |
| `STABLES_API_URL` | No | `https://api.sandbox.stables.money` | API base URL |

### API URLs

| Environment | URL |
|-------------|-----|
| Sandbox | `https://api.sandbox.stables.money` |
| Production | `https://api.stables.money` |

### Supported Networks

`arbitrum`, `avalanche_c_chain`, `base`, `ethereum`, `optimism`, `polygon`, `solana`, `stellar`, `tron`

### Supported Stablecoins

`usdc`, `usdt`, `dai`, `pyusd`, `eurc`

---

## Security

- API keys are only read from environment variables - never hardcoded
- All inputs are validated with Zod schemas
- Idempotency keys are generated for all write operations
- Never log sensitive data to stdout (breaks STDIO transport)
- Use per-agent API keys for better access control and auditability

---

## Troubleshooting

### Server not appearing in Claude Desktop
- Ensure `claude_desktop_config.json` is valid JSON
- Check the `args` path points to the correct `build/index.js` location
- Restart Claude Desktop completely (Cmd+Q, then reopen)

### "Invalid or missing authorization credentials"
- Check your `STABLES_API_KEY` is valid
- Ensure you're using the correct API URL (sandbox vs production)

### "externalCustomerId Invalid input"
- The `externalCustomerId` field is required by the API
- The MCP server auto-generates one if not provided

### Quote expired before transfer
- Quotes expire after 30 seconds
- Create a new quote and execute the transfer immediately

### Tools not showing up
- Run `npm run build` to ensure latest code is compiled
- Check for TypeScript compilation errors
- Restart Claude Desktop after rebuilding
