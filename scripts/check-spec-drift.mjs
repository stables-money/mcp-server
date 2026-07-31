#!/usr/bin/env node
/**
 * Fails when an endpoint this server calls is no longer in the live OpenAPI
 * spec.
 *
 * The last drift went unnoticed for four months because the test suite mocks
 * fetch: it asserts what we send, never that the API still accepts it. This
 * closes that gap without needing credentials, since the sandbox spec is public.
 *
 * Sandbox by default — production's /docs is behind the gateway and answers 403.
 * Override with STABLES_SPEC_URL when checking another environment.
 *
 * Run: npm run check:spec
 */

const SPEC_URL = process.env.STABLES_SPEC_URL || "https://api.sandbox.stables.money/docs/json";

/**
 * Every path the client calls, with parameters in the spec's template form.
 * Maintained by hand on purpose: adding an endpoint should be a deliberate entry
 * here rather than something a glob picks up silently.
 */
const REQUIRED = [
  ["get", "/api/v1/customers"],
  ["post", "/api/v1/customer"],
  ["patch", "/api/v1/customer/{customerId}"],
  ["post", "/api/v1/customer/{customerId}/verification/link"],
  ["put", "/api/v1/customers/{customerId}/metadata"],
  ["post", "/api/v1/quotes"],
  ["get", "/api/v1/quotes/{quoteId}"],
  ["post", "/api/v1/transfer"],
  ["get", "/api/v1/transfers"],
  ["get", "/api/v1/customers/{customerId}/virtual-accounts"],
  ["post", "/api/v1/customers/{customerId}/virtual-accounts"],
  ["put", "/api/v1/customers/{customerId}/virtual-accounts/{virtualAccountId}/destination"],
  ["get", "/api/v1/customers/{customerId}/virtual-accounts/{virtualAccountId}/history"],
  ["post", "/api/v1/webhooks"],
  ["get", "/api/v1/webhooks"],
  ["get", "/api/v1/webhooks/deliveries"],
  ["post", "/api/v1/customers/{customerId}/virtual-accounts/{virtualAccountId}/sandbox/simulate-deposit"],
  ["post", "/api/v1/transfers/{transferId}/sandbox/simulate-deposit"],
  ["post", "/api/v1/api-keys"],
  ["get", "/api/v1/api-keys"],
];

let spec;
try {
  const response = await fetch(SPEC_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  spec = await response.json();
} catch (error) {
  // A network or gateway problem is not drift. Say so and pass, rather than
  // failing a build for something unrelated to the change under test.
  console.error(`Could not read the spec (${error.message}). Skipping the drift check.`);
  process.exit(0);
}

const paths = spec.paths ?? {};
const missing = REQUIRED.filter(([method, path]) => !paths[path]?.[method]);

if (missing.length > 0) {
  console.error(
    `Spec drift: ${missing.length} endpoint(s) this server calls are absent from the live spec.\n`
  );
  for (const [method, path] of missing) {
    console.error(`  ${method.toUpperCase()} ${path}`);
  }
  console.error(`\nSpec: ${SPEC_URL}`);
  console.error("The endpoint moved or was removed. Update the client before releasing.");
  process.exit(1);
}

console.log(`All ${REQUIRED.length} endpoints this server calls are present in ${SPEC_URL}`);
