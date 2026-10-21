/**
 * Contract test: the MCP against what is documented and what the API accepts.
 *
 * The unit tests mock fetch and assert what we send, which is how four months
 * of drift once went unnoticed: they stayed green against an API that had moved.
 * This test calls every tool with inputs generated from its own schema, captures
 * each request, and checks it against the references fetched by
 * scripts/fetch-reference.mjs:
 *
 *   - Coverage: every operation documented on docs.stables.money is reachable
 *     through some tool (the MCP mirrors the docs).
 *   - Requests: path, method, query parameters, required headers and the JSON
 *     body validate against the live OpenAPI spec, with unknown body keys
 *     rejected (zod on the server strips them silently, so they never 400).
 *   - Responses: each tool is fed a response generated from the spec and must
 *     render it without "undefined", "NaN" or "[object Object]", which is what
 *     reading a renamed field looks like.
 *
 * Skipped when reference/ is absent. Run with: npm run check:spec
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { StablesApiClient } from "./lib/stables-client.js";
import { createStablesMcpServer } from "./server.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Operation = { method: string; path: string; page?: string };

/**
 * Operations the MCP calls that the docs do not (yet) document. Each is real
 * and deployed; listing it here is a statement that we expose it on purpose.
 * A new undocumented call fails the test until it is added, with a reason.
 */
const UNDOCUMENTED_ON_PURPOSE: Record<string, string> = {
  "GET /api/v1/quotes/{quoteId}": "re-read a quote before transferring",
  "GET /api/v1/transfers/{transferId}": "poll one transfer's status",
  "PUT /api/v1/customers/{customerId}/metadata": "documented as part of Update Customer",
  "POST /api/v1/customer/{customerId}/verification/link": "KYC link for an existing customer",
  "PATCH /api/v1/customers/{customerId}/virtual-accounts/{virtualAccountId}":
    "set deposit_handling_mode on a route",
  "GET /api/v1/webhooks/deliveries": "debug webhook delivery",
  "POST /api/v1/customers/{customerId}/virtual-accounts/{virtualAccountId}/sandbox/simulate-deposit":
    "sandbox testing",
  "POST /api/v1/transfers/{transferId}/sandbox/simulate-deposit": "sandbox testing",
};

/**
 * Documented operations with no tool, on purpose. Empty is the goal; an entry
 * needs a reason a person would accept.
 */
const DOCUMENTED_NOT_EXPOSED: Record<string, string> = {};

/** Extra inputs for tools whose branches a single generated input cannot reach. */
const EXTRA_CASES: Record<string, Json[]> = {
  list_virtual_accounts: [{}], // no customerId: the list across every customer
};

const haveReference =
  existsSync("reference/spec.json") && existsSync("reference/docs-operations.json");
const UUID = "11111111-1111-4111-8111-111111111111";

// ---------- sample generation ----------

function sampleString(name: string, schema: Json): string {
  if (schema.format === "uuid" || /(^|_)id$|Id$/.test(name)) return UUID;
  if (schema.format === "date-time") return "2026-01-31T00:00:00.000Z";
  if (schema.format === "date" || /date|dob|birth/i.test(name)) return "1990-01-31";
  if (schema.format === "uri" || /url/i.test(name)) return "https://example.com/hook";
  if (schema.format === "email" || /email/i.test(name)) return "agent@example.com";
  if (/amount|size|volume/i.test(name)) return "100.00";
  if (/country/i.test(name)) return "AU";
  if (/currency/i.test(name)) return "USDT";
  if (/phone/i.test(name)) return "+61400000000";
  return "sample";
}

/** Fills every property, so optional fields get sent and checked too. */
function sample(schema: Json, root: Json, name = "", depth = 0): unknown {
  schema = deref(schema, root);
  if (depth > 8) return undefined;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.default !== undefined && typeof schema.default !== "object") return schema.default;
  for (const key of ["anyOf", "oneOf"]) {
    if (schema[key]) {
      const branch =
        schema[key].find((s: Json) => deref(s, root).type !== "null") ?? schema[key][0];
      return sample(branch, root, name, depth + 1);
    }
  }
  if (schema.allOf) {
    return Object.assign({}, ...schema.allOf.map((s: Json) => sample(s, root, name, depth + 1)));
  }
  const type = Array.isArray(schema.type)
    ? schema.type.find((t: string) => t !== "null")
    : schema.type;
  switch (type) {
    case "string":
      return sampleString(name, schema);
    case "integer":
    case "number":
      return schema.minimum ?? 10;
    case "boolean":
      return true;
    case "array":
      return [sample(schema.items ?? {}, root, name, depth + 1)];
    case "null":
      return null;
    default: {
      if (!schema.properties) return type === "object" ? {} : "sample";
      const out: Json = {};
      for (const [key, value] of Object.entries<Json>(schema.properties)) {
        const v = sample(value, root, key, depth + 1);
        if (v !== undefined) out[key] = v;
      }
      return out;
    }
  }
}

function deref(schema: Json, root: Json): Json {
  while (schema && schema.$ref) {
    schema = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((node: Json, key: string) => node[key], root);
  }
  return schema ?? {};
}

/** One input with every field, plus one per alternative value of each top-level enum. */
function inputsFor(schema: Json): Json[] {
  const full = sample(schema, schema) as Json;
  const cases = [full];
  for (const [key, value] of Object.entries<Json>(schema.properties ?? {})) {
    for (const option of (value.enum ?? []).slice(1)) cases.push({ ...full, [key]: option });
  }
  return cases;
}

// ---------- spec matching ----------

function matchOperation(spec: Json, method: string, pathname: string): Operation | undefined {
  for (const template of Object.keys(spec.paths)) {
    const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`);
    if (pattern.test(pathname) && spec.paths[template][method.toLowerCase()]) {
      return { method: method.toUpperCase(), path: template };
    }
  }
  return undefined;
}

/**
 * Replaces each discriminated oneOf (by `type` or `customer_type`) with the
 * branch the data names, so a business customer is checked against the
 * business schema rather than reported against whichever branch it missed least.
 */
function narrow(schema: Json, data: unknown, root: Json): Json {
  if (!data || typeof data !== "object" || Array.isArray(data)) return schema;
  const value = data as Json;
  const union = schema.oneOf ?? schema.anyOf;
  if (union) {
    for (const prop of [schema.discriminator?.propertyName, "type", "customer_type"].filter(
      Boolean
    )) {
      const branch = union.find((b: Json) => {
        const p = deref(b, root).properties?.[prop];
        return p && (p.const === value[prop] || p.enum?.includes(value[prop]));
      });
      if (branch && value[prop] !== undefined) return narrow(deref(branch, root), data, root);
    }
    return schema;
  }
  const resolved = schema.$ref ? deref(schema, root) : schema;
  if (!resolved.properties) return schema;
  const properties: Json = {};
  for (const [key, sub] of Object.entries<Json>(resolved.properties)) {
    properties[key] = narrow(sub, value[key], root);
  }
  return { ...resolved, properties };
}

/** Closes every object schema that does not say otherwise, so unknown keys fail. */
function closed(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(closed);
  if (!schema || typeof schema !== "object") return schema;
  const out: Json = {};
  for (const [key, value] of Object.entries(schema)) out[key] = closed(value);
  if (out.properties && out.additionalProperties === undefined) out.additionalProperties = false;
  return out;
}

type AjvError = {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message?: string;
  params: Json;
  data?: unknown;
};

/**
 * Keeps the errors that mean the MCP and the API disagree on shape: unknown or
 * missing fields, wrong types, values outside an enum. Length, pattern and
 * format failures come from the generated sample values, not the MCP, and for
 * a oneOf only the closest branch is reported, not every branch it missed.
 */
function structuralErrors(errors: AjvError[]): string[] {
  const branchOf = (e: AjvError) => e.schemaPath.match(/^(.*\/oneOf)\/(\d+)\//);
  const counts = new Map<string, Map<string, number>>();
  for (const e of errors) {
    const m = branchOf(e);
    if (!m) continue;
    const branches = counts.get(m[1]) ?? new Map<string, number>();
    branches.set(m[2], (branches.get(m[2]) ?? 0) + 1);
    counts.set(m[1], branches);
  }
  // A branch whose discriminator (`type`, `customer_type`) rejected the value is
  // not the one the request meant; among the rest, the fewest errors wins.
  const mismatched = new Set(
    errors
      .filter((e) => e.keyword === "const" || e.keyword === "enum")
      .map((e) => e.schemaPath.match(/^(.*\/oneOf\/\d+)\/properties\/(type|customer_type)\//)?.[1])
      .filter(Boolean)
  );
  const best = new Map(
    [...counts].map(([k, b]) => {
      const ranked = [...b].sort((x, y) => x[1] - y[1]);
      return [k, (ranked.find(([n]) => !mismatched.has(`${k}/${n}`)) ?? ranked[0])[0]];
    })
  );
  return errors
    .filter((e) =>
      ["additionalProperties", "required", "type", "enum", "const"].includes(e.keyword)
    )
    .filter((e) => {
      const m = branchOf(e);
      return !m || best.get(m[1]) === m[2];
    })
    .map((e) => {
      if (e.keyword === "additionalProperties")
        return `${e.instancePath || "/"} unknown field "${e.params.additionalProperty}"`;
      if (e.keyword === "enum")
        return `${e.instancePath} is ${JSON.stringify(e.data)}, API takes ${JSON.stringify(e.params.allowedValues)}`;
      return `${e.instancePath || "/"} ${e.message}`;
    })
    .filter((m, i, all) => all.indexOf(m) === i);
}

type Captured = { method: string; url: URL; headers: Record<string, string>; body?: unknown };

describe.skipIf(!haveReference)("contract with docs.stables.money and the live API", () => {
  let spec: Json;
  let docs: { operations: Operation[]; unrendered: string[]; specVersion: string };
  let client: Client;
  let tools: { name: string; inputSchema: Json }[];
  let captured: Captured[] = [];
  const called = new Set<string>();
  const sent = new Map<string, Set<string>>();
  const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false, verbose: true });
  addFormats(ajv);
  ajv.addFormat("e164", /^\+[1-9]\d{1,14}$/);
  const validators = new Map<string, ReturnType<typeof ajv.compile>>();

  beforeAll(async () => {
    spec = JSON.parse(readFileSync("reference/spec.json", "utf8"));
    docs = JSON.parse(readFileSync("reference/docs-operations.json", "utf8"));
    ajv.addSchema({ $id: "spec", components: closed(spec.components) });

    vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      const method = (init.method ?? "GET").toUpperCase();
      captured.push({
        method,
        url,
        headers: Object.fromEntries(
          Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
            k.toLowerCase(),
            v,
          ])
        ),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      const op = matchOperation(spec, method, url.pathname);
      const responses = op ? (spec.paths[op.path][op.method.toLowerCase()].responses ?? {}) : {};
      const status = Object.keys(responses).find((s) => s.startsWith("2")) ?? "200";
      const schema = responses[status]?.content?.["application/json"]?.schema;
      const body = schema ? sample(schema, spec) : {};
      return new Response(JSON.stringify(body), {
        status: Number(status) === 204 ? 200 : Number(status),
        headers: { "content-type": "application/json" },
      });
    });

    const api = new StablesApiClient(
      "sti_test_contract_secret",
      "https://api.sandbox.stables.money"
    );
    const server = createStablesMcpServer(api);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "contract-test", version: "0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    tools = (await client.listTools()).tools as typeof tools;
  });

  afterAll(() => vi.unstubAllGlobals());

  it("every tool sends requests the live API accepts and renders its responses", async () => {
    const problems: string[] = [];

    for (const tool of tools) {
      for (const args of [...inputsFor(tool.inputSchema), ...(EXTRA_CASES[tool.name] ?? [])]) {
        captured = [];
        const result = (await client.callTool({ name: tool.name, arguments: args })) as Json;
        const text = (result.content ?? []).map((c: Json) => c.text ?? "").join("\n");
        const where = `${tool.name}(${JSON.stringify(args).slice(0, 120)})`;

        if (captured.length === 0) {
          problems.push(`${where}: made no request. ${result.isError ? text.slice(0, 200) : ""}`);
          continue;
        }
        for (const request of captured) {
          const op = matchOperation(spec, request.method, request.url.pathname);
          if (!op) {
            problems.push(
              `${where}: ${request.method} ${request.url.pathname} is not in the live spec`
            );
            continue;
          }
          const key = `${op.method} ${op.path}`;
          called.add(key);
          const fields = sent.get(key) ?? new Set<string>();
          for (const name of request.url.searchParams.keys()) fields.add(`?${name}`);
          if (request.body && typeof request.body === "object") {
            for (const [name, value] of Object.entries(request.body as Json)) {
              fields.add(name);
              if (value && typeof value === "object" && !Array.isArray(value)) {
                for (const inner of Object.keys(value)) fields.add(`${name}.${inner}`);
              }
            }
          }
          sent.set(key, fields);
          const operation = spec.paths[op.path][op.method.toLowerCase()];
          const params: Json[] = operation.parameters ?? [];

          const allowedQuery = new Set(params.filter((p) => p.in === "query").map((p) => p.name));
          for (const name of request.url.searchParams.keys()) {
            if (!allowedQuery.has(name))
              problems.push(`${where}: ${key} has no query parameter "${name}"`);
          }
          for (const p of params.filter((p) => p.required && p.in !== "path")) {
            const present =
              p.in === "query"
                ? request.url.searchParams.has(p.name)
                : p.in === "header" && p.name.toLowerCase() in request.headers;
            if (!present && p.in !== "cookie") {
              problems.push(`${where}: ${key} requires ${p.in} "${p.name}", which was not sent`);
            }
          }

          const bodySchema = operation.requestBody?.content?.["application/json"]?.schema;
          if (bodySchema && request.body !== undefined) {
            const narrowed = JSON.stringify(closed(narrow(bodySchema, request.body, spec))).replace(
              /"#\/components/g,
              '"spec#/components'
            );
            let validate = validators.get(narrowed);
            if (!validate) {
              validate = ajv.compile(JSON.parse(narrowed));
              validators.set(narrowed, validate);
            }
            if (!validate(request.body)) {
              const errors = structuralErrors(validate.errors ?? []);
              if (errors.length > 0) {
                problems.push(`${where}: ${key} body rejected:\n      ${errors.join("\n      ")}`);
              }
            }
          } else if (
            !bodySchema &&
            request.body !== undefined &&
            Object.keys(request.body as Json).length > 0
          ) {
            problems.push(`${where}: ${key} takes no body, but one was sent`);
          }
        }

        if (result.isError) {
          problems.push(`${where}: returned an error for a valid response: ${text.slice(0, 200)}`);
        } else if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(text)) {
          const line = text
            .split("\n")
            .find((l: string) => /\bundefined\b|\bNaN\b|\[object Object\]/.test(l));
          problems.push(`${where}: rendered a field the response does not have: "${line?.trim()}"`);
        }
      }
    }

    const unique = [...new Map(problems.map((p) => [p.replace(/^\w+\(.*?\): /, ""), p])).values()];
    expect(unique, `\n  ${unique.join("\n  ")}\n`).toEqual([]);
  });

  it("reports what the API accepts that no tool sends", () => {
    // Informational: a documented parameter with no tool input is a missing
    // feature, but not every one is worth exposing, so this lists without failing.
    const documented = new Set(docs.operations.map((o) => `${o.method} ${o.path}`));
    const lines: string[] = [];
    for (const key of [...called].filter((k) => documented.has(k)).sort()) {
      const [method, path] = key.split(" ");
      const operation = spec.paths[path][method.toLowerCase()];
      const accepted = new Set<string>(
        (operation.parameters ?? [])
          .filter((p: Json) => p.in === "query")
          .map((p: Json) => `?${p.name}`)
      );
      const body = deref(operation.requestBody?.content?.["application/json"]?.schema ?? {}, spec);
      const branches = body.oneOf ?? body.anyOf ?? [body];
      for (const branch of branches) {
        for (const [name, value] of Object.entries<Json>(deref(branch, spec).properties ?? {})) {
          accepted.add(name);
          for (const inner of Object.keys(deref(value, spec).properties ?? {}))
            accepted.add(`${name}.${inner}`);
        }
      }
      const unsent = [...accepted].filter(
        (f) =>
          (!sent.get(key)?.has(f) && !sent.get(key)?.has(f.split(".")[0])) ||
          (f.includes(".") && sent.get(key)?.has(f.split(".")[0]) && !sent.get(key)?.has(f))
      );
      const top = unsent.filter((f) => !f.includes(".") || sent.get(key)?.has(f.split(".")[0]));
      if (top.length > 0) lines.push(`${key}\n      ${top.join(", ")}`);
    }
    // eslint-disable-next-line no-console
    if (lines.length > 0) console.log(`API fields no tool sends:\n  ${lines.join("\n  ")}`);
  });

  it("every documented operation is reachable through a tool", () => {
    const missing = docs.operations
      .map((o) => `${o.method} ${o.path}`)
      .filter((key, i, all) => all.indexOf(key) === i)
      .filter((key) => !called.has(key) && !(key in DOCUMENTED_NOT_EXPOSED))
      .map(
        (key) => `${key}  (${docs.operations.find((o) => `${o.method} ${o.path}` === key)?.page})`
      );
    expect(missing, `\n  Documented with no tool:\n  ${missing.join("\n  ")}\n`).toEqual([]);
  });

  it("every undocumented call is deliberate", () => {
    const documented = new Set(docs.operations.map((o) => `${o.method} ${o.path}`));
    const extra = [...called].filter(
      (key) => !documented.has(key) && !(key in UNDOCUMENTED_ON_PURPOSE)
    );
    expect(
      extra,
      `\n  Called but not documented; document it or list it with a reason:\n  ${extra.join("\n  ")}\n`
    ).toEqual([]);
  });
});
