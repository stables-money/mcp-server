# Changelog

## [2.6.0] - 2026-10-25

Safer agent connections: labelled tools, read-only by default.

### Added
- **Every tool is labelled.** Each of the 51 tools now carries a title and
  MCP annotations: reads are `readOnlyHint`, every change (including any
  money movement) is `destructiveHint`, so clients such as Claude ask the
  person to confirm each one. `create_transfer` and `create_webhook` are also
  `openWorldHint`. The table lives in `src/tool-policy.ts`, and the server
  refuses to start if a tool is missing from it.
- **Read and write scopes.** OAuth connections get `stables:read`; the consent
  page offers "Read only" (the default) or "Read and make changes"
  (`stables:write`). A read-only connection still sees the write tools, and
  calling one answers 403 `insufficient_scope` naming `stables:write`, which
  MCP clients use to ask the person for more access. The protected resource
  metadata advertises only `stables:read`.

### Changed
- An agent connected through OAuth can no longer create or revoke API keys
  (`create_api_key`, `revoke_api_key` are hidden). Listing keys still works.
- Callers that send their own API key keep full access, unchanged.
- Connections made before this release keep read and write access (the old
  `stables` scope).

## [2.5.2] - 2026-10-24

### Fixed
- Clicking "Allow and sign in" sent Claude "access denied" instead of going
  to the login page: the double-submit guard added in 2.5.1 disabled the
  buttons during the submit event, and a disabled button's `decision=approve`
  value is left out of the form data, so the server read the submit as a
  cancel. The buttons are now disabled after the submit has been built.
  Found in the Worker log (consent page, Allow, then no callback and no
  Auth0 login) and reproduced with a real click.

## [2.5.1] - 2026-10-24

Hosted sign-in: one look from consent to login, and safer sign-in.

### Changed
- The consent and error pages now share the Stables login's design (coin
  video, dark card, same type), so the hop from consent to the Auth0 login
  screen reads as one flow. The hero says what the sign-in is for: "Connect
  your AI agent".
- Auth0 is asked for credentials on every agent sign-in (`prompt=login`). A
  browser that still held an Auth0 session for someone else (staff signed in
  as a customer, a shared machine) had that session reused silently, and the
  key was minted in that account's organisation.

### Fixed
- Re-submitting the consent form (Arc does this when its popup is moved into a
  window) found the one-time handle already used and showed "not started in
  this browser" although the first submit had gone through. Buttons disable on
  first submit, and a reused handle says the sign-in is continuing elsewhere.

## [2.5.0] - 2026-10-23

Hosted server: OAuth sign-in and production through the gateway.

### Added
- **OAuth for the hosted server.** `mcp.stables.money` is now an OAuth
  authorization server as well as the MCP endpoint, so Claude.ai, ChatGPT and
  any client that can't hold a key connect by signing in. Discovery
  (`/.well-known/oauth-protected-resource/mcp`,
  `/.well-known/oauth-authorization-server`), dynamic registration and Client
  ID Metadata Documents, PKCE, refresh tokens. The consent page asks sandbox or
  production, the user signs in with their Stables dashboard account through
  Auth0, and the server creates an API key in that organisation (named after
  the client) which serves every later call. Revoking the key in the dashboard
  disconnects the client. Built on `@cloudflare/workers-oauth-provider`; grant
  props are encrypted at rest.
- **Gateway signature.** With the `MCP_GATEWAY_SIGNING_SECRET` secret set, the
  hosted server signs each forwarded request (`X-Stables-Mcp-Signature`) so the
  API gateway's IP authoriser accepts production traffic from the Worker's
  shared egress IPs (api-lambda-authoriser#4).
- The hosted server identifies itself with a `User-Agent` on API calls.

### Changed
- API keys sent as `X-Api-Key` keep working; they are mapped onto the
  `Authorization` header before the OAuth host sees the request.
- An unauthenticated `/mcp` request now gets the RFC 9728 challenge
  (`WWW-Authenticate: Bearer … resource_metadata=…`) so OAuth clients can find
  the sign-in; API-key callers see the same 401 as before.

## [2.4.0] - 2026-10-22

Covers every endpoint now documented on docs.stables.money (51 tools), and
tests the tools against sandbox.

### Added
- **Compliance requests (RFIs):** `list_rfis`, `list_customer_rfis`, `get_rfi`,
  `get_rfi_evidence_form`, `submit_rfi_evidence`, and `get_kyc_capabilities`.
  Each RFI requirement is rendered with what to do next.
- **Documents:** `add_document`, `list_documents`, `get_document_download_url`,
  `delete_document`, on a transfer or a payment route deposit.
- `register_route_payid`: register a PayID on an AUD payment route.
- **End-to-end test** (`src/e2e.test.ts`, `npm run test:e2e`): connects an MCP
  client to the server and calls the tools against sandbox, failing on any
  error or broken render. Reads, plus round trips it undoes (a webhook, a
  document); never moves money; refuses a live key. Runs in CI with the
  `STABLES_SANDBOX_API_KEY` secret and skips without it.

### Fixed
- `delete_webhook` and `revoke_api_key` failed against the live API (HTTP 415):
  the API refuses a DELETE with no body. The client now sends an empty JSON
  body on DELETE. Found by the new end-to-end test.
- The contract test read docs.stables.money's GitBook layout and crashed after
  the move to the new docs site (`llms.txt has no "API Reference" section`),
  failing CI. It now reads the new `llms.txt` and each reference page's
  `<APIPage>` operations, and a layout it can't read fails loudly instead of
  passing.
- Operations the docs now document are no longer listed as deliberately
  undocumented.

## [2.3.0] - 2026-10-21

The server now mirrors docs.stables.money, and a contract test keeps it that
way.

### Added
- **Balances:** `get_balance`, `get_balance_wallet`, `create_balance_wallet`,
  `list_balance_activity`, `list_pending_balance_deposits`,
  `list_whitelisted_wallets`, and `fundingSource: "prefund_balance"` on
  `create_transfer` to pay from the balance.
- **Entitlements:** `list_available_entitlements`, `request_entitlements`,
  `submit_entitlement_requirements`.
- `validate_payment_method`: check payout details against a corridor before
  spending a quote.
- `create_customer_onboarding_link`: create a customer and a hosted
  verification link in one call.
- AUD route whitelisting: `list_route_whitelist`, `add_route_whitelist_account`,
  `update_route_whitelist_account`.
- `list_virtual_accounts` lists across every customer when `customerId` is
  omitted, and pages with `startingAfter`. `list_customers` pages with
  `pageSize`/`pageToken`. `get_customer` takes `include`.
- **Contract test** (`src/contract.test.ts`, `npm run check:spec`): calls every
  tool and validates each request against the live OpenAPI spec (unknown
  fields, missing required fields, enums), renders a spec-shaped response
  through each tool, and fails when an operation documented on
  docs.stables.money has no tool. Replaces the hand-kept endpoint list.

### Fixed
- `get_verification_link` sent `ttlInSecs`/`successUrl`/`rejectUrl` in
  camelCase, so the API dropped them: links always had the default TTL and no
  redirect. Also takes `verificationType` now.
- `create_transfer` offered PayID types `phone` and `org_id`, which the API
  rejects; they are `phone_number` and `organisation_id`, and `acn` is added.
  `purposeCode` is now the API's list of codes rather than free text.
- `create_customer` (business) sent four fields the API no longer accepts
  (`main_source_of_funds`, `is_your_business_a_dao`, `industry_selection`,
  `how_did_you_come_across_stables`); removed.
- `create_virtual_account` sent `developer_fee_percent`, which the API ignores
  (the developer fee is set per organisation now); removed.
- Entitlement inputs accept `gbp_virtual_account` and the full list.

## [2.2.1] - 2026-10-05

Re-release of 2.2.0 with no code changes. It was cut because 2.2.0 appeared to
be missing from npm; the cause turned out to be an endpoint-protection policy
on the publisher's machine that hides packages younger than a minimum age, not
the registry. Both versions are published and installable.

## [2.2.0] - 2026-10-03

The server is now hosted. Until this release the only way to use it was to run
it on your own machine over stdio, which is not how MCP servers are consumed
any more: clients expect a URL.

### Added
- **Hosted endpoint** at `https://mcp.stables.money/mcp` over Streamable HTTP.
  Nothing to install; send your Stables API key as a bearer token and the key
  decides the environment, exactly as `STABLES_API_KEY` does for the local
  server. The service is stateless and holds no credentials of its own.
- `src/http/handler.ts`: a web-standard `Request → Response` handler, with two
  entry points that share it: a Cloudflare Worker (`src/worker.ts`,
  `wrangler.toml`) and a Node process (`src/serve.ts`, `Dockerfile`).
- `src/server.ts`: one factory builds the MCP server for every transport, so
  the tool surface cannot differ between hosted and local.
- Root and `/health` endpoints describing the server, and CORS for
  browser-based clients.

### Changed
- `npx stables-mcp-server` still works and is unchanged, but the README now
  leads with the hosted endpoint.

### Not yet
- OAuth sign-in, which Claude.ai custom connectors and ChatGPT connectors
  require. The 401 already carries a bearer challenge; the authorization
  server and discovery metadata come next.

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
