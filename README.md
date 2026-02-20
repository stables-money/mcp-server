# Stables MCP Server

An MCP (Model Context Protocol) server that exposes the Stables fiat-to-crypto API to AI agents. This allows AI assistants like Claude, ChatGPT, and others to manage customers, create quotes, execute transfers, and handle virtual accounts programmatically.

## What is MCP?

MCP (Model Context Protocol) is an open standard that provides a standardized way to connect AI applications to external tools and data sources. Think of it like a "USB-C port for AI" - any AI that supports MCP can use any MCP server.

## Features

This MCP server provides 24 tools across 6 categories:

### Customer Management
- `create_customer` - Create individual or business customers
- `get_customer` - Get customer details and verification status
- `list_customers` - List all customers
- `get_verification_link` - Generate KYC verification links
- `update_customer` - Update customer details and entitlements
- `update_customer_metadata` - Update customer metadata key-value pairs

### Quotes
- `create_quote` - Get exchange rate quotes (USDC/USDT to fiat)
- `get_quote` - Check quote status and details

### Transfers
- `create_transfer` - Execute a transfer using an active quote
- `get_transfer` - Check transfer status
- `list_transfers` - List transfers with filters

### Virtual Accounts
- `create_virtual_account` - Create virtual bank accounts for fiat deposits
- `list_virtual_accounts` - List virtual accounts for a customer
- `update_virtual_account` - Update virtual account settings
- `deactivate_virtual_account` - Deactivate a virtual account
- `reactivate_virtual_account` - Reactivate a deactivated virtual account
- `get_virtual_account_history` - Get activity history for a virtual account

### API Keys
- `create_api_key` - Create a new API key
- `list_api_keys` - List all API keys
- `get_api_key` - Get API key details
- `revoke_api_key` - Revoke an API key

### Webhooks
- `create_webhook` - Subscribe to events via webhook
- `list_webhooks` - List all webhook subscriptions
- `delete_webhook` - Delete a webhook subscription

## Installation

```bash
# Install from npm
npm install -g stables-mcp-server

# Or clone and build from source
git clone https://github.com/stables-money/mcp-server.git
cd mcp-server
npm install
npm run build
```

## Configuration

The server requires the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `STABLES_API_KEY` | Yes | Your Stables API key |
| `STABLES_API_URL` | No | API base URL (default: `https://api.sandbox.stables.money`) |

## Usage

### With Claude Desktop

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

**User:** "Create a customer for john@example.com and get a quote to convert 1000 USDC to EUR"

**AI (using MCP tools):**
1. Calls `create_customer` with email and type
2. Calls `create_quote` with USDC, amount, EUR destination, network, country, and payment method
3. Returns customer details and quote information

### Checking transfer status

**User:** "What's the status of all my pending transfers?"

**AI (using MCP tools):**
1. Calls `list_transfers` with `status=PENDING`
2. Returns formatted list of pending transfers

### Setting up auto-payout

**User:** "Create a virtual USD account for customer abc123 that auto-pays to my Polygon USDC wallet 0x..."

**AI (using MCP tools):**
1. Calls `create_virtual_account` with customer ID, USD currency, and Polygon destination
2. Returns virtual account details with deposit instructions

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Test with MCP Inspector
npm run inspect
```

## Project Structure

```
stables-mcp-server/
├── src/
│   ├── index.ts              # Main entry point
│   ├── lib/
│   │   └── stables-client.ts # Stables API client
│   └── tools/
│       ├── customers.ts      # Customer management tools (6)
│       ├── quotes.ts         # Quote tools (2)
│       ├── transfers.ts      # Transfer tools (3)
│       ├── virtual-accounts.ts # Virtual account tools (6)
│       ├── api-keys.ts       # API key tools (4)
│       └── webhooks.ts       # Webhook tools (3)
├── package.json
├── tsconfig.json
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

#### deactivate_virtual_account
Deactivate a virtual account to prevent new deposits.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| virtualAccountId | string | Yes | Virtual account ID |

#### reactivate_virtual_account
Reactivate a previously deactivated virtual account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| virtualAccountId | string | Yes | Virtual account ID |

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
- Never log sensitive data (breaks STDIO transport)
- All inputs are validated with Zod schemas

## License

MIT

## Links

- [Stables API Documentation](https://docs.stables.money)
- [npm Package](https://www.npmjs.com/package/stables-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
