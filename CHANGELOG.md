# Changelog

## [2.1.0] - 2026-07-31

Finishes the sync started in 2.0.0, and adds a check so the next drift is caught
by CI rather than by a customer.

### Added
- `list_webhook_deliveries` — recent delivery attempts with status codes, attempt
  counts and retry times. The first place to look when events stop arriving.
- `update_route_destination` — change the payout wallet on an existing payment
  route, rather than creating a second one.
- `simulate_route_deposit` and `simulate_transfer_deposit` (sandbox only) —
  without these an agent cannot drive a deposit to a terminal state in test,
  since a real bank payment would be required.
- `npm run check:spec`, wired into CI: fails when an endpoint this server calls
  is absent from the live OpenAPI spec, and skips itself when the spec is
  unreachable. The test suite mocks fetch, so it proves what we send and nothing
  about what the API still accepts — which is how four months of drift went
  unnoticed. This check found two real problems on its first run.

### Fixed
- `create_virtual_account` requires the payout destination, which the API has
  always demanded for fiat-to-crypto routes, and sends `workflow_type`. It no
  longer sends `deposit_handling_mode`, which is not part of the create schema
  and was being silently ignored — use `update_virtual_account` for that.
- `get_virtual_account_history` reads the real record shape. It expected
  `{count, data}` with `type`/`amount`/`currency` per row; the API returns
  `{data, has_more}` with `deposit_amount`/`deposit_currency`/`payout_*`, so every
  row printed "undefined: undefined undefined".
- Removed the `eventType` filter from `get_virtual_account_history`: it was
  accepted and then discarded, and no such filter exists.
- `list_webhooks` no longer advertises `WEBHOOK_EVENT_TYPE_*` names in its empty
  state; those were renamed and would 400 if used.
- README examples corrected — they still showed `status=PENDING` and a
  `paymentMethodType` that no longer exist.
- Default stablecoin on a new payment route is USDT rather than USDC, matching
  the product.

### Removed
- `validate_payment_method`, and the RFI and verification-capability tools, are
  not in this release. Their endpoints exist on the API's `dev/main` branch but
  are **not deployed** to sandbox or production, so the tools would have returned
  404 to every caller. `validate_payment_method` shipped in 2.0.0 by mistake for
  the same reason. They return once those endpoints are released.

### Note
The idempotency key was reported as being regenerated per retry, which would have
risked double-submitting a payout. That was wrong: the key is built once at the
call site and the same options object is reused across attempts. There is now a
test pinning it.

## [2.0.0] - 2026-07-30

Breaking. The server had drifted roughly four months behind the API: the
customer, transfer, quote and virtual-account surfaces moved to snake_case with
restructured bodies, so every `create_transfer`, `create_customer` and
`create_quote` call was failing validation, and `update_customer` was returning
200 while changing nothing.

### Breaking
- `create_transfer` sends `customer_id`/`quote_id` and a discriminated
  `destination` instead of the nested `paymentMethod.bankTransfer`. Bank codes
  are flat.
- `create_quote` sends `source`/`destination` instead of `from`/`to`.
  `paymentMethodType` is gone — use `destinationNetwork` (`swift`/`bank`).
  `customerId` is no longer accepted.
- Quote endpoints return the quote directly; the `{ quote }` wrapper is gone.
- `create_customer`/`update_customer` send snake_case. `customerType` values are
  now `individual`/`business`, and `email` is required.
- Webhook event types are dotted lowercase (`transfer.created`, `all`, …) and
  validated as an enum.
- Transfer, quote, customer and verification statuses are lowercase on the wire.
- Removed `send_verification_sms`: it called Twilio rather than Stables, for a
  channel the product does not offer.
- Removed `deactivate_virtual_account` and `reactivate_virtual_account`: those
  routes exist only on the dashboard surface and 404 for an API key.

### Added
- `validate_payment_method` — checks payout details against a currency's rules
  without creating a quote or transfer. Always answers 200 with structured
  errors, so an agent can discover requirements before committing.
- `create_transfer` accepts the enhanced beneficiary fields required for AED,
  CAD, EUR, GBP, MXN and USD payouts: `recipientType`, `dateOfBirth` and a full
  beneficiary address. Also PayID, CAD institution/transit codes, CNAPS,
  `purposeCode`, and crypto payout destinations.
- `create_quote` accepts `preview` and all eight live networks (was ethereum and
  polygon only).
- Entitlements extended to `eur_virtual_account`, `usd_virtual_account` and
  `aed_local`.
- The base URL is inferred from the API key's environment segment
  (`sti_test_…` → sandbox, `sti_live_…` → production). `STABLES_API_URL` still
  overrides.

### Fixed
- `get_verification_link` read `kycLink`/`customerId` where the API returns
  `kyc_link`/`customer_id`, so it reported the link as `undefined`.
- `list_transfers` sent camelCase query params, so the customer filter and all
  paging were silently ignored and every call returned page one.
- Tests now assert the request bodies themselves. The suite mocked `fetch` and
  checked nothing about what was sent, which is how it stayed green through the
  entire migration.

## [1.2.0] - 2026-02-27

### Added
- `send_verification_sms` tool for sending KYC verification links via Twilio SMS
- Request timeouts (30s) with AbortController to prevent hung connections
- Exponential backoff retry logic for transient failures (429, 5xx, network errors)
- Rate limit awareness with Retry-After header parsing
- `StablesApiError` class for structured error handling with HTTP status codes
- HTTPS enforcement for API URL at startup
- Vitest test suite with 28 tests covering the API client
- ESLint with `no-console` rule to prevent debug logging leaks
- Prettier for consistent code formatting
- GitHub Actions CI/CD (lint, build, test on Node 18/20/22)
- Automated npm publishing via GitHub Releases

### Changed
- Expanded business customer fields (compliance controls, industry selection, DAO flag, source of funds, legal address)
- Virtual account history now supports `depositId`, `startingAfter`, `endingBefore` pagination params
- Pinned `@modelcontextprotocol/sdk` from `^1.0.0` to `^1.26.0`
- Graceful handling of 204 No Content API responses

### Fixed
- Removed all `console.error` debug logging that was corrupting MCP STDIO transport
- Fixed version mismatch between `index.ts` and `package.json`

### Security
- API URL must use HTTPS (rejects `http://` at startup)
- No sensitive data in error responses

## [1.1.0]

### Added
- Virtual account management tools
- API key management tools
- Webhook subscription tools
- Customer metadata updates

## [1.0.0]

### Added
- Initial release
- Customer management (create, get, list, update, verify)
- Quote creation and retrieval
- Transfer execution and tracking
