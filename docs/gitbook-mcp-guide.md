# MCP

Connect Claude, Cursor, Codex, VS Code and any other MCP-compatible client to the Stables API through the Model Context Protocol. An agent connected this way can onboard customers, price and execute USDT payouts, open payment routes for fiat deposits, and reconcile webhooks, all through the same API your code uses.

MCP (Model Context Protocol) is an open standard for connecting AI applications to external tools, like a USB-C port for AI: any client that speaks MCP can use any MCP server.

For agent-specific discovery and safety guidance, see [AI agents](ai-agents) and [Agent safety](agent-safety).

***

## Connect in one step

The Stables MCP server is hosted. There is nothing to install and nothing to run. Point your client at:

```
https://mcp.stables.money/mcp
```

and send your Stables API key as a bearer token. The key you created during onboarding is all you need, and it decides which environment you reach:

| Your key | Where requests go |
| --- | --- |
| `sti_test_…` | Sandbox (`api.sandbox.stables.money`). No real money moves. |
| `sti_live_…` | Production (`api.stables.money`). **Real money moves.** |

Start with a sandbox key. The hosted server stores no credentials of its own; every request carries yours, and a request without a valid key is refused before it reaches the API.

### Claude Code

```bash
claude mcp add --transport http stables https://mcp.stables.money/mcp --header "Authorization: Bearer ${STABLES_API_KEY}"
```

### Cursor, VS Code, Windsurf and other clients with a `url` field

Add this to the client's MCP configuration (`~/.cursor/mcp.json`, `.vscode/mcp.json`, and so on):

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

In `~/.codex/config.toml`:

```toml
[mcp_servers.stables]
url = "https://mcp.stables.money/mcp"
bearer_token_env_var = "STABLES_API_KEY"
```

### Claude Desktop, Claude.ai and ChatGPT

These clients connect to remote servers through OAuth sign-in rather than a fixed key. OAuth for the hosted Stables server is in progress. Until it ships, Claude Desktop can run the server locally (see below); Claude.ai and ChatGPT are not yet supported.

### Try it

Start a new conversation and ask: **"List my Stables customers"**. The agent calls `list_customers` and shows what is in your sandbox.

***

## Run it locally instead

The same server is published to npm and runs as a local process over stdio. Use this when your client only supports local servers (Claude Desktop today), when you work against a `sti_local_…` key and your own deployment, or when the client cannot reach the internet.

Requirements: Node.js 18 or later.

For Claude Desktop, add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then quit and reopen Claude Desktop:

```json
{
  "mcpServers": {
    "stables": {
      "command": "npx",
      "args": ["stables-mcp-server"],
      "env": {
        "STABLES_API_KEY": "sti_test_..."
      }
    }
  }
}
```

| Variable | Required | Description |
| --- | --- | --- |
| `STABLES_API_KEY` | Yes | Your Stables API key. The `sti_test_` or `sti_live_` prefix picks the environment, exactly as it does for the hosted server. |
| `STABLES_API_URL` | No | Overrides the environment the key implies. Needed only for a `sti_local_…` key or a non-standard deployment. Must be HTTPS. |

Source and issues: [github.com/stables-money/mcp-server](https://github.com/stables-money/mcp-server).

***

## Tools

The server exposes 26 tools. Each one mirrors a documented Stables API endpoint and nothing else; the reference below is generated from the server's own tool schemas, so it matches what your client sees.

### Customers

#### create_customer

Create a new customer in Stables for KYC verification and transfers. Use 'individual' for personal accounts or 'business' for company accounts. Include entitlements like 'base_payout' to enable transactions.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | No | Customer's email address |
| `customerType` | `individual` \| `business` | Yes | Type of customer - 'individual' for personal, 'business' for companies |
| `firstName` | string | No | First name (required for individuals) |
| `lastName` | string | No | Last name (required for individuals) |
| `middleName` | string | No | Middle name |
| `dob` | string | No | Date of birth in YYYY-MM-DD format (e.g., '1990-01-15') |
| `nationality` | string | No | Two-letter country code (e.g., 'US', 'GB') |
| `companyName` | string | No | Company name (required for businesses) |
| `country` | string | No | Country code ISO 3166-1 alpha-2 (required for businesses, e.g., 'US') |
| `registrationNumber` | string | No | Business registration number |
| `incorporatedOn` | string | No | Date of incorporation in YYYY-MM-DD format |
| `type` | string | No | Company type (e.g., 'Private Company Limited by Shares') |
| `taxId` | string | No | Tax ID (e.g., '12-3456789') |
| `registrationLocation` | string | No | Registration location (e.g., state for USA) |
| `website` | string | No | Website URL |
| `describeBusiness` | string | No | Description of the business |
| `conductMoneyServices` | boolean | No | Whether the company conducts money services |
| `describeMoneyServices` | string | No | Describe money services (required if conductMoneyServices is true) |
| `describeComplianceControls` | string | No | Description of compliance controls |
| `mainSourceOfFunds` | `BUSINESS_LOANS` \| `GRANTS` \| `INTER_COMPANY_FUNDS` \| `INVESTMENT_PROCEEDS` \| `LEGAL_SETTLEMENT` \| `OWNERS_CAPITAL` \| `PENSION_RETIREMENT` \| `SALE_OF_ASSETS` \| `SALES_OF_GOODS_AND_SERVICES` \| `THIRD_PARTY_FUNDS` \| `TREASURY_RESERVES` | No | Main source of funds |
| `accountPurpose` | `CHARITABLE_DONATIONS` \| `ECOMMERCE_RETAIL_PAYMENTS` \| `INVESTMENT_PURPOSES` \| `PAYMENTS_TO_FRIENDS_OR_FAMILY_ABROAD` \| `PAYROLL` \| `PERSONAL_OR_LIVING_EXPENSES` \| `PROTECT_WEALTH` \| `PURCHASE_GOODS_AND_SERVICES` \| `RECEIVE_PAYMENTS_FOR_GOODS_AND_SERVICES` \| `TAX_OPTIMIZATION` \| `THIRD_PARTY_MONEY_TRANSMISSION` \| `TREASURY_MANAGEMENT` \| `OTHER` | No | What will you use Stables for? |
| `accountPurposeOther` | string | No | Explain purpose (required if accountPurpose is OTHER) |
| `isYourBusinessADao` | boolean | No | Is your business a DAO? |
| `industrySelection` | string | No | NAICS industry code (e.g., '5415') |
| `expectedAnnualRevenue` | `0_99999` \| `100000_999999` \| `1000000_9999999` \| `10000000_49999999` \| `50000000_249999999` \| `250000000_plus` | No | Estimated annual revenue in USD |
| `expectedMonthlyPayments` | string | No | Expected monthly payments in USD |
| `sourceOfFunds` | `BUSINESS_LOANS` \| `GRANTS` \| `INTER_COMPANY_FUNDS` \| `INVESTMENT_PROCEEDS` \| `LEGAL_SETTLEMENT` \| `OWNERS_CAPITAL` \| `PENSION_RETIREMENT` \| `SALE_OF_ASSETS` \| `SALES_OF_GOODS_AND_SERVICES` \| `THIRD_PARTY_FUNDS` \| `TREASURY_RESERVES` | No | Source of funds |
| `sourceOfFundsDescription` | string | No | Describe where your business funds come from |
| `operateInProhibitedCountry` | boolean | No | Does your business operate in any prohibited countries? |
| `doesYourBusinessEngageInHighRiskActivities` | `yes` \| `no` | No | Does your business engage in high risk activities? |
| `acceptTerms` | boolean | No | Accept Stables' terms of service and privacy policy |
| `howDidYouComeAcrossStables` | string | No | How did you come across Stables? |
| `externalCustomerId` | string | No | Your own reference ID for this customer |
| `phone` | string | No | Phone number with country code (e.g., '+14155552671') |
| `entitlements` | array of `base_payout` \| `virtual_account` | No | List of entitlements to request |
| `addressLine1` | string | No | Street address line 1 |
| `addressLine2` | string | No | Street address line 2 |
| `addressCity` | string | No | City |
| `addressState` | string | No | State or region |
| `addressPostalCode` | string | No | Postal/ZIP code |
| `addressCountry` | string | No | Two-letter country code (e.g., 'US') |
| `legalAddressLine1` | string | No | Legal address line 1 (for businesses) |
| `legalAddressLine2` | string | No | Legal address line 2 (for businesses) |
| `legalAddressCity` | string | No | Legal address city (for businesses) |
| `legalAddressState` | string | No | Legal address state (for businesses) |
| `legalAddressPostalCode` | string | No | Legal address postal code (for businesses) |
| `legalAddressCountry` | string | No | Legal address country code (for businesses) |

#### get_customer

Get details about a specific customer including their verification status

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to look up |

#### list_customers

List all customers for the authenticated tenant

_No parameters._

#### get_verification_link

Generate a KYC verification link for a customer. The customer must complete verification before they can make transfers.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to generate verification link for |
| `ttlInSecs` | number | No | Time-to-live for the KYC link in seconds (default: 1800) |
| `successUrl` | string | No | URL to redirect to after successful verification |
| `rejectUrl` | string | No | URL to redirect to after rejected verification |

#### update_customer

Update customer details, entitlements, or verification information

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to update |
| `email` | string | No | Updated email address |
| `phone` | string | No | Updated phone number |
| `firstName` | string | No | Updated first name |
| `lastName` | string | No | Updated last name |
| `middleName` | string | No | Updated middle name |
| `dob` | string | No | Updated date of birth (YYYY-MM-DD) |
| `nationality` | string | No | Updated nationality (two-letter country code) |
| `companyName` | string | No | Updated company name (for businesses) |
| `entitlements` | array of `base_payout` \| `virtual_account` | No | Updated entitlements |

#### update_customer_metadata

Update customer metadata key-value pairs

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to update metadata for |
| `metadata` | object | Yes | Metadata key-value pairs to set |

### Quotes

#### create_quote

Get a quote for a currency exchange: the rate, the fees, and what the customer receives. Quotes are short-lived, so create one immediately before the transfer. Off-ramp converts a stablecoin to fiat (source network required, destination country required); on-ramp converts fiat to a stablecoin (destination address required). Set preview to price without committing.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sourceCurrency` | string | Yes | Source currency: a stablecoin for off-ramp (e.g. 'USDT'), fiat for on-ramp |
| `sourceAmount` | string | Yes | Amount to convert, in major units (e.g. '125.75') |
| `sourceNetwork` | `arbitrum` \| `avalanche` \| `base` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `tron` | No | Blockchain network of the source. Required for off-ramp, omitted for on-ramp |
| `destinationCurrency` | string | Yes | Destination currency: fiat for off-ramp (e.g. 'EUR'), a stablecoin for on-ramp |
| `destinationCountry` | string | No | Destination country, ISO 2-letter. Required for off-ramp |
| `destinationNetwork` | string | No | Off-ramp: payment network, 'swift' or 'bank'. On-ramp: blockchain network. Replaces the old paymentMethodType |
| `destinationAddress` | string | No | Destination wallet address. Required for on-ramp |
| `preview` | boolean | No | Price the quote without persisting it, to show an estimate |
| `metadata` | object | No | Optional metadata |

#### get_quote

Get details about an existing quote including its current status

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `quoteId` | string | Yes | The quote ID to look up |

### Transfers

#### create_transfer

Execute a transfer using an active quote. The quote must not be expired. This initiates real money movement, so get explicit human approval first. For payouts in AED, CAD, EUR, GBP, MXN, USD you must also supply recipientType, the full beneficiary address, and dateOfBirth when the recipient is an individual.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID for this transfer |
| `quoteId` | string | Yes | The quote ID to execute |
| `destinationType` | `bank` \| `crypto` | No | Payout target: a bank account (off-ramp) or a wallet address. Default: `"bank"`. |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US') |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `addressStreet` | string | No | Beneficiary street address |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone` \| `abn` \| `org_id` | No | PayID alias type. Required when payId is given |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |
| `destinationCurrency` | string | No | Stablecoin to deliver when destinationType is crypto (e.g. 'USDT') |
| `destinationNetwork` | string | No | Blockchain network when destinationType is crypto (e.g. 'polygon') |
| `destinationAddress` | string | No | Wallet address when destinationType is crypto |
| `purposeCode` | string | No | Purpose of the transfer (e.g. 'SALARY'). Required on some corridors |
| `metadata` | object | No | Optional metadata |

#### get_transfer

Get the current status and details of a transfer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer ID to look up |

#### list_transfers

List transfers with optional filters for status, type, or customer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `created` \| `compliance_hold` \| `awaiting_funds_collection` \| `funds_collected` \| `in_progress` \| `payment_submitted` \| `payment_processed` \| `completed` \| `failed` \| `cancelled` \| `expired` | No | Filter by transfer status |
| `type` | `onramp` \| `offramp` | No | Filter by transfer type |
| `customerId` | string | No | Filter by customer ID |
| `pageSize` | number | No | Number of transfers per page (default: 20) |
| `pageToken` | string | No | Token for the next page of results |

### Payment routes

#### create_virtual_account

Create a payment route (virtual bank account) so a customer can receive fiat deposits that convert to a stablecoin and pay out to a wallet. The payout destination is mandatory: the API refuses a fiat-to-crypto route without one. Deposit handling is set server-side and defaults to auto_payout; change it afterwards with update_virtual_account.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to create the payment route for |
| `sourceCurrency` | string | Yes | Fiat currency the route collects in (e.g. 'AUD', 'USD', 'EUR') |
| `destinationAddress` | string | Yes | Wallet address deposits are paid out to. Validated against the chosen network |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | Yes | Blockchain network the payout address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | Stablecoin to receive. Default: `"usdt"`. |
| `developerFeePercent` | string | No | Your fee on each deposit, as a numeric string (e.g. '0.5') |

#### list_virtual_accounts

List all virtual accounts for a customer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to list virtual accounts for |
| `status` | `activated` \| `deactivated` \| `pending` \| `closed` | No | Filter by account status |
| `limit` | number | No | Maximum number of accounts to return |

#### update_virtual_account

Update virtual account settings (e.g., deposit handling mode)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The virtual account ID to update |
| `depositHandlingMode` | `auto_payout` \| `hold` \| `manual` | Yes | New deposit handling mode |

#### get_virtual_account_history

Get the activity history for a virtual account (deposits, payouts, etc.)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The virtual account ID |
| `limit` | number | No | Maximum number of events to return (default: 10) |

#### update_route_destination

Change the payout wallet on an existing payment route. Deposits after this point are paid out to the new address; use it when a customer rotates wallets rather than creating a second route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route (virtual account) ID |
| `destinationAddress` | string | Yes | New payout wallet address |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | Yes | Blockchain network the new address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | Stablecoin to receive. Default: `"usdt"`. |

### Sandbox

#### simulate_route_deposit

SANDBOX ONLY. Simulate a fiat deposit into a payment route so you can watch the conversion and payout complete without a real bank transfer. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route (virtual account) ID |
| `amount` | string | Yes | Deposit amount in major units (e.g. '500.00') |
| `scenario` | `create_only` \| `completed` \| `failed` | No | 'completed' runs the deposit through to payout, 'failed' exercises the failure path, 'create_only' stops at the deposit |
| `senderName` | string | No | Name to attribute the deposit to |
| `senderReference` | string | No | Payment reference on the deposit |
| `externalDepositId` | string | No | Your own reference for this deposit |

#### simulate_transfer_deposit

SANDBOX ONLY. Simulate the customer sending the crypto an off-ramp transfer is waiting on, so the transfer can progress to payout without an on-chain payment. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer awaiting funds |

### API keys

#### create_api_key

Create a new API key for accessing the Stables API. The secret key is only shown once on creation - save it immediately.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | A descriptive name for this API key (e.g., 'Production Bot', 'Agent Smith') |
| `metadata` | object | No | Optional metadata to attach to the key |

#### list_api_keys

List all API keys for the current account

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pageSize` | number | No | Number of keys per page |
| `pageToken` | string | No | Token for the next page |

#### get_api_key

Get details about a specific API key

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKeyId` | string | Yes | The API key ID to look up |

#### revoke_api_key

Revoke an API key. This permanently disables the key and cannot be undone.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKeyId` | string | Yes | The API key ID to revoke |

### Webhooks

#### create_webhook

Subscribe to Stables events via webhook. You'll receive POST requests to your URL when events occur.

Event types are dotted and lowercase. Use 'all' to receive everything.

Security: Set a secret to enable HMAC-SHA256 signature verification via X-Webhook-Signature header.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | A descriptive name for this webhook (e.g., 'Transfer status notifications') |
| `url` | string | Yes | The HTTPS URL to receive webhook POST requests |
| `eventTypes` | array of `customer.created` \| `customer.updated` \| `kyc_link.updated.status_transitioned` \| `transfer.created` \| `transfer.updated.status_transitioned` \| `quote.created` \| `quote.updated.status_transitioned` \| `virtual_account.created` \| `virtual_account.activity.created` \| `virtual_account.activity.updated.status_transitioned` \| `travel_rule.wallet_verification_required` \| `rfi.created` \| `rfi.updated` \| `rfi.resolved` \| `all` | Yes | Event types to subscribe to (e.g. ['transfer.updated.status_transitioned']), or ['all'] |
| `secret` | string | No | Optional signing secret for HMAC-SHA256 webhook signature verification |

#### list_webhooks

List all webhook subscriptions for the current account

_No parameters._

#### delete_webhook

Delete a webhook subscription. You will stop receiving events at this endpoint.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `webhookId` | string | Yes | The webhook subscription ID to delete |

#### list_webhook_deliveries

List recent webhook delivery attempts with their HTTP status and retry state. This is the first place to look when an integration is not receiving events: it shows whether Stables sent them and what the endpoint answered.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pageSize` | number | No | How many attempts to return (default 10, max 50) |
| `status` | `PENDING` \| `SUCCESS` \| `FAILED` \| `RETRYING` | No | Filter by delivery status |
| `eventType` | string | No | Filter by event type (e.g. 'transfer.created') |

***

## Example workflows

**Onboard a customer**

> "Create an individual customer for john@example.com with the base_payout entitlement and give me a KYC link"

The agent calls `create_customer`, then `get_verification_link` for the new customer, and returns a link to share. Links expire after 30 minutes by default.

**Price and execute a payout**

> "Quote 500 USDT on Polygon to EUR for customer abc123"

The agent calls `create_quote` and shows the rate, the fees and what the beneficiary receives, along with when the quote expires. Quotes are short-lived, so create one immediately before the transfer.

> "Execute it to IBAN GR16 0110 1250 0000 0001 2300 695 at Alpha Bank, account holder Maria Papadopoulou"

The agent calls `create_transfer` with the quote and the beneficiary details, and returns the transfer ID, its status and the wallet address the USDT must be sent to. Some currencies require more beneficiary detail than others; the tool description lists what each currency needs.

**Open a payment route**

> "Create a USD payment route for customer abc123 that pays out USDT on Base to 0x…"

The agent calls `create_virtual_account` and returns the deposit instructions. Later, "change the payout wallet on that route" calls `update_route_destination`, and "show me the deposit history" calls `get_virtual_account_history`.

**Test a deposit in sandbox**

> "Simulate a 250 USD deposit into that route"

The agent calls `simulate_route_deposit`, which drives the route to a terminal state without a real bank payment. Sandbox only.

**Reconcile webhooks**

> "Set up a webhook at https://example.com/stables that fires when transfers change status"

The agent calls `create_webhook` with `transfer.updated.status_transitioned`. If events stop arriving, "show me recent webhook deliveries" calls `list_webhook_deliveries`, the first place to look.

***

## Security

* The hosted server holds no credentials. Your key travels with each request and is only ever forwarded to the Stables environment it belongs to.
* A key is never accepted in the URL, only in the `Authorization` or `X-Api-Key` header.
* Every write carries an idempotency key, built once per call, so a retried request cannot submit a payout twice.
* Create a separate API key per agent and revoke it from the dashboard when the agent is retired. An agent holding a `sti_live_` key can move real money on your behalf; read [Agent safety](agent-safety) before going live.
* Keep human confirmation on for `create_transfer` and other money-moving tools in your client.

***

## Troubleshooting

**401 from `mcp.stables.money` with `"error": "unauthorized"`**

The request reached the hosted server without a usable key. Check that the `Authorization: Bearer` header is set and that the key starts with `sti_test_` or `sti_live_`. A `sti_local_` key cannot be routed by the hosted server; run it locally with `STABLES_API_URL` instead.

**"Invalid or missing authorization credentials" inside a tool result**

The key reached the Stables API and was refused there. It has been revoked, or it belongs to the other environment. Check the key in the dashboard.

**The client connects but calls time out or are refused**

If your organization has an IP allowlist configured on its API keys, requests through the hosted server arrive from Cloudflare's addresses, not yours. Either run the server locally from an allowlisted address, or remove the allowlist for the key the agent uses.

**Quote expired before the transfer**

Quotes have a short lifetime. Create a new quote and execute the transfer straight away.

**Local server not appearing in Claude Desktop**

Check that the config file is valid JSON, that `STABLES_API_KEY` is set in the `env` block, and that you fully quit Claude Desktop (Cmd+Q) before reopening it. Run `npx stables-mcp-server@latest` once in a terminal to confirm Node can download and start it.
