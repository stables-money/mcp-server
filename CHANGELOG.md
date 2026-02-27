# Changelog

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
