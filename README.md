# Stables MCP Server

An MCP (Model Context Protocol) server that exposes the Stables fiat-to-crypto API to AI agents. This allows AI assistants like Claude, ChatGPT, and others to manage customers, create quotes, execute transfers, and handle virtual accounts programmatically.

## What is MCP?

MCP (Model Context Protocol) is an open standard that provides a standardized way to connect AI applications to external tools and data sources. Think of it like a "USB-C port for AI" - any AI that supports MCP can use any MCP server.

## Features

This MCP server provides the following tools:

### Customer Management
- `create_customer` - Create individual or business customers
- `get_customer` - Get customer details and verification status
- `list_customers` - List all customers with pagination
- `get_verification_link` - Generate KYC verification links

### Quotes
- `create_quote` - Get exchange rate quotes for currency conversion
- `get_quote` - Check quote status and details

### Transfers
- `create_transfer` - Execute a transfer using an active quote
- `get_transfer` - Check transfer status
- `list_transfers` - List transfers with filters

### Virtual Accounts
- `create_virtual_account` - Create virtual bank accounts for fiat deposits
- `list_virtual_accounts` - List virtual accounts for a customer

## Installation

```bash
# Clone or download the repository
cd stables-mcp-server

# Install dependencies
npm install

# Build the TypeScript
npm run build
```

## Configuration

The server requires the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `STABLES_API_KEY` | Yes | Your Stables API key |
| `STABLES_API_URL` | No | API base URL (default: `https://sandbox.stables-api.com`) |

## Usage

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stables": {
      "command": "node",
      "args": ["/path/to/stables-mcp-server/build/index.js"],
      "env": {
        "STABLES_API_KEY": "your-api-key",
        "STABLES_API_URL": "https://sandbox.stables-api.com"
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
export STABLES_API_URL=https://sandbox.stables-api.com

# Run the inspector
npm run inspect
```

### Direct Execution

```bash
STABLES_API_KEY=your-api-key node build/index.js
```

## Example Conversations

### Creating a customer and getting a quote

**User:** "Create a customer for john@example.com and get a quote for $1000 USD to USDC"

**AI (using MCP tools):**
1. Calls `create_customer` with email and type
2. Calls `create_quote` with customer ID, USD amount, and USDC destination
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
│       ├── customers.ts      # Customer management tools
│       ├── quotes.ts         # Quote tools
│       ├── transfers.ts      # Transfer tools
│       └── virtual-accounts.ts # Virtual account tools
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
| businessName | string | No | Business name (for businesses) |

#### get_customer
Get customer details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |

#### list_customers
List all customers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pageSize | number | No | Results per page |
| pageToken | string | No | Pagination token |

#### get_verification_link
Generate a KYC verification link.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| verificationType | "KYC" \| "KYB" | No | Verification type |

### Quote Tools

#### create_quote
Get a quote for currency exchange.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| fromCurrency | string | Yes | Source currency (e.g., "USD") |
| fromAmount | string | Yes | Amount to convert |
| toCurrency | string | Yes | Destination currency (e.g., "USDC") |
| toCountry | string | No | Country for fiat payouts |
| fromNetwork | string | No | Blockchain network |

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
| metadata | object | No | Optional metadata |

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
| destinationNetwork | string | No | Blockchain network |
| destinationCurrency | string | No | Stablecoin (default: "usdc") |

#### list_virtual_accounts
List virtual accounts for a customer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | string | Yes | Customer ID |
| status | string | No | Filter by status |
| limit | number | No | Max results |

## Security

- API keys are only read from environment variables
- Never log sensitive data (breaks STDIO transport)
- All inputs are validated with Zod schemas

## License

MIT

## Links

- [Stables API Documentation](https://docs.stables.money)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
