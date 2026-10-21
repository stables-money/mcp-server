#!/usr/bin/env node
/**
 * Downloads the two references the contract test checks this server against:
 *
 *   - What is documented: every operation on the API Reference pages of
 *     docs.stables.money, plus every "METHOD /api/v1/..." the guides name
 *     (Balances and Entitlements are documented only in the guides). The MCP
 *     mirrors the docs, so a documented operation with no tool is a missing
 *     feature.
 *   - What the API accepts: the live OpenAPI spec. Sandbox runs the same `main`
 *     as production, and production's /docs is behind the gateway (403).
 *
 * Writes reference/spec.json and reference/docs-operations.json (gitignored).
 * Exits 0 without writing anything if either source is unreachable, unless
 * STABLES_SPEC_STRICT is set (the scheduled freshness run).
 *
 * Run: npm run check:spec (fetches, then runs the contract test)
 */

import { mkdirSync, writeFileSync } from "node:fs";

const SPEC_URL = process.env.STABLES_SPEC_URL || "https://api.sandbox.stables.money/docs/json";
const DOCS_URL = process.env.STABLES_DOCS_URL || "https://docs.stables.money";

/**
 * Pages whose operation GitBook does not render, because the spec uploaded to
 * GitBook predates the endpoint. Their markdown has no "## METHOD /path"
 * heading, so the operation is taken from the docs repo instead. Each one is
 * reported, since it means the published reference shows no schema; the fix is
 * re-uploading the spec in GitBook, after which the entry can go.
 */
const UNRENDERED = {
  "api-reference/balances/get-balance": [["GET", "/api/v1/prefund/balance"]],
  "api-reference/balances/list-whitelisted-wallets": [["GET", "/api/v1/prefund/whitelisted-wallets"]],
};

async function get(url, as) {
  const response = await fetch(url, { headers: { "user-agent": "stables-mcp-server contract check" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return as === "json" ? response.json() : response.text();
}

let spec, index;
try {
  [spec, index] = await Promise.all([get(SPEC_URL, "json"), get(`${DOCS_URL}/llms.txt`, "text")]);
} catch (error) {
  if (process.env.STABLES_SPEC_STRICT) {
    console.error(`Could not read the references (${error.message}).`);
    process.exit(1);
  }
  // A network or gateway problem is not drift. Say so and pass, rather than
  // failing a build for something unrelated to the change under test.
  console.error(`Could not read the references (${error.message}). Skipping the contract check.`);
  process.exit(0);
}

const sections = index.split(/^## /m);
const linksIn = (title) => {
  const section = sections.find((part) => part.startsWith(title));
  if (!section) throw new Error(`${DOCS_URL}/llms.txt has no "${title}" section`);
  return [...section.matchAll(/\]\((https:\/\/[^)]+\.md)\)/g)].map((m) => m[1]);
};
const pages = linksIn("API Reference");
const guides = [...linksIn("Get Started"), ...linksIn("Developer Platform")];

/** Maps a path as a guide writes it ({customer_id}, :customerId, va_123) onto the spec's template. */
function specPath(method, written) {
  const segments = written.replace(/[.,;)]+$/, "").split("/");
  return Object.keys(spec.paths).find((template) => {
    const parts = template.split("/");
    return (
      spec.paths[template][method.toLowerCase()] &&
      parts.length === segments.length &&
      parts.every((part, i) => part === segments[i] || (part.startsWith("{") && segments[i] !== ""))
    );
  });
}

const operations = [];
const unrendered = [];
for (const url of pages) {
  const page = new URL(url).pathname.replace(/^\//, "").replace(/\.md$/, "");
  const markdown = await get(url, "text");
  const found = [...markdown.matchAll(/^## (GET|POST|PUT|PATCH|DELETE) (\/\S+)$/gm)].map((m) => [
    m[1],
    m[2],
  ]);
  if (found.length === 0 && UNRENDERED[page]) {
    unrendered.push(page);
    found.push(...UNRENDERED[page]);
  }
  for (const [method, path] of found) operations.push({ method, path, page });
}

for (const url of guides) {
  const page = new URL(url).pathname.replace(/^\//, "").replace(/\.md$/, "");
  const markdown = await get(url, "text");
  for (const m of markdown.matchAll(/\b(GET|POST|PUT|PATCH|DELETE) `?(\/api\/v1\/[\w/{}:.-]+)/g)) {
    const path = specPath(m[1], m[2]);
    if (path && !operations.some((o) => o.method === m[1] && o.path === path)) {
      operations.push({ method: m[1], path, page });
    }
  }
}

mkdirSync("reference", { recursive: true });
writeFileSync("reference/spec.json", JSON.stringify(spec));
writeFileSync(
  "reference/docs-operations.json",
  JSON.stringify({ source: DOCS_URL, specVersion: spec.info?.version, operations, unrendered }, null, 2)
);

const pagesWithout = pages.length - new Set(operations.map((o) => o.page)).size;
console.log(
  `Spec ${spec.info?.version} from ${SPEC_URL}; ${operations.length} documented operations on ${pages.length} pages.`
);
if (pagesWithout > 0) console.log(`${pagesWithout} reference page(s) document no operation.`);
for (const page of unrendered) {
  console.warn(
    `warning: ${DOCS_URL}/${page} renders no schema; GitBook's uploaded spec is missing it. Re-upload the spec in GitBook.`
  );
}
