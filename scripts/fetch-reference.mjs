#!/usr/bin/env node
/**
 * Downloads the two references the contract test checks this server against:
 *
 *   - What is documented: every operation on the API Reference pages of
 *     docs.stables.money, plus every "METHOD /api/v1/..." the guides name
 *     (Entitlements are documented only in the guides). The MCP mirrors the
 *     docs, so a documented operation with no tool is a missing feature.
 *     Pages are read as markdown (<page>.md); a reference page names its
 *     operations in an <APIPage operations={[...]}> element.
 *   - What the API accepts: the live OpenAPI spec. Sandbox runs the same release
 *     as production, and production's /docs is behind the gateway (403).
 *
 * Writes reference/spec.json and reference/docs-operations.json (gitignored).
 * Exits 0 without writing anything if either source is unreachable, unless
 * STABLES_SPEC_STRICT is set (the scheduled freshness run). A docs layout this
 * script no longer understands fails it: that is a broken check, not an outage.
 *
 * Run: npm run check:spec (fetches, then runs the contract test)
 */

import { mkdirSync, writeFileSync } from "node:fs";

const SPEC_URL = process.env.STABLES_SPEC_URL || "https://api.sandbox.stables.money/docs/json";
const DOCS_URL = process.env.STABLES_DOCS_URL || "https://docs.stables.money";

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

/**
 * llms.txt lists each section as a top-level "- Title" bullet, with its pages
 * as relative links nested under it.
 */
function linksIn(title) {
  const links = [];
  let section;
  for (const line of index.split("\n")) {
    const heading = line.match(/^- (?!\[)(.+?)\s*$/);
    if (heading) section = heading[1];
    const link = line.match(/\]\((\/[^)\s]*)\)/);
    if (link && section === title) links.push(new URL(`${link[1]}.md`, DOCS_URL).href);
  }
  if (links.length === 0) {
    console.error(`${DOCS_URL}/llms.txt has no "${title}" section; the docs layout changed.`);
    process.exit(1);
  }
  return links;
}
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
const add = (method, path, page) => {
  if (!operations.some((o) => o.method === method && o.path === path)) operations.push({ method, path, page });
};

for (const url of pages) {
  const page = new URL(url).pathname.replace(/^\//, "").replace(/\.md$/, "");
  const markdown = await get(url, "text");
  for (const m of markdown.matchAll(/<APIPage[^>]*operations=\{(\[.*?\])\}/g)) {
    for (const op of JSON.parse(m[1])) add(op.method.toUpperCase(), op.path, page);
  }
}

for (const url of guides) {
  const page = new URL(url).pathname.replace(/^\//, "").replace(/\.md$/, "");
  const markdown = await get(url, "text");
  for (const m of markdown.matchAll(/\b(GET|POST|PUT|PATCH|DELETE) `?(\/api\/v1\/[\w/{}:.-]+)/g)) {
    const path = specPath(m[1], m[2]);
    if (path) add(m[1], path, page);
  }
}

mkdirSync("reference", { recursive: true });
writeFileSync("reference/spec.json", JSON.stringify(spec));
writeFileSync(
  "reference/docs-operations.json",
  JSON.stringify({ source: DOCS_URL, specVersion: spec.info?.version, operations }, null, 2)
);

const pagesWithout = pages.length - new Set(operations.map((o) => o.page)).size;
console.log(
  `Spec ${spec.info?.version} from ${SPEC_URL}; ${operations.length} documented operations on ${pages.length} pages.`
);
if (pagesWithout > 0) console.log(`${pagesWithout} reference page(s) document no operation.`);
