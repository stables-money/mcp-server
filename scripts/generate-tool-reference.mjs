#!/usr/bin/env node
/**
 * Renders the tool reference for the docs from the server's own tool schemas,
 * so the published reference cannot drift from what the server actually
 * exposes. Run after `npm run build`:
 *
 *   node scripts/generate-tool-reference.mjs > docs/tool-reference.md
 *
 * It drives the built HTTP handler with a tools/list request, exactly as a
 * client would, and groups the result by category.
 */

import { handleRequest } from "../build/http/handler.js";

const CATEGORIES = [
  ["Customers", ["create_customer", "get_customer", "list_customers", "get_verification_link", "update_customer", "update_customer_metadata"]],
  ["Quotes", ["create_quote", "get_quote"]],
  ["Transfers", ["create_transfer", "get_transfer", "list_transfers"]],
  ["Payment routes", ["create_virtual_account", "list_virtual_accounts", "update_virtual_account", "get_virtual_account_history", "update_route_destination"]],
  ["Sandbox", ["simulate_route_deposit", "simulate_transfer_deposit"]],
  ["API keys", ["create_api_key", "list_api_keys", "get_api_key", "revoke_api_key"]],
  ["Webhooks", ["create_webhook", "list_webhooks", "delete_webhook", "list_webhook_deliveries"]],
];

const response = await handleRequest(
  new Request("https://mcp.stables.money/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer sti_test_docs_generator",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  })
);
const { result } = await response.json();
const tools = new Map(result.tools.map((t) => [t.name, t]));

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();

function typeOf(schema) {
  if (!schema) return "";
  if (schema.enum) return schema.enum.map((v) => `\`${v}\``).join(" \\| ");
  if (schema.anyOf) return schema.anyOf.map(typeOf).join(" \\| ");
  if (schema.type === "array") {
    const inner = typeOf(schema.items) || "string";
    return inner.includes("\\|") ? `array of ${inner}` : `${inner}[]`;
  }
  if (schema.type === "object" && schema.properties) return "object";
  if (schema.type === "object") return "object";
  return schema.type ?? "";
}

function table(schema) {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  const names = Object.keys(props);
  if (names.length === 0) return "_No parameters._\n";
  const rows = names.map((n) => {
    const p = props[n];
    let desc = esc(p.description);
    if (p.default !== undefined) {
      if (desc && !/[.!?]$/.test(desc)) desc += ".";
      desc += ` Default: \`${JSON.stringify(p.default)}\`.`;
    }
    return `| \`${n}\` | ${typeOf(p)} | ${required.has(n) ? "Yes" : "No"} | ${desc.trim()} |`;
  });
  return ["| Parameter | Type | Required | Description |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

const out = [];
const seen = new Set();
for (const [category, names] of CATEGORIES) {
  out.push(`### ${category}\n`);
  for (const name of names) {
    const tool = tools.get(name);
    if (!tool) {
      process.stderr.write(`warning: ${name} is in CATEGORIES but not exposed by the server\n`);
      continue;
    }
    seen.add(name);
    out.push(`#### ${name}\n`);
    out.push(`${tool.description.trim()}\n`);
    out.push(table(tool.inputSchema));
  }
}
const unlisted = [...tools.keys()].filter((n) => !seen.has(n));
if (unlisted.length) {
  process.stderr.write(`warning: not categorised, add to CATEGORIES: ${unlisted.join(", ")}\n`);
  process.exitCode = 1;
}
process.stdout.write(out.join("\n"));
