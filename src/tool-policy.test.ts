import { describe, it, expect } from "vitest";
import { createStablesMcpServer } from "./server.js";
import { StablesApiClient } from "./lib/stables-client.js";
import { TOOL_POLICY, annotationsFor } from "./tool-policy.js";

type Registered = Record<
  string,
  { enabled: boolean; title?: string; annotations?: Record<string, unknown> }
>;

function tools(grant?: { read: boolean; write: boolean; admin: boolean }): Registered {
  const server = createStablesMcpServer(
    new StablesApiClient("sti_test_a_b", "https://api.example.invalid"),
    grant ? { grant } : {}
  );
  return (server as unknown as { _registeredTools: Registered })._registeredTools;
}

describe("tool policy", () => {
  it("covers exactly the registered tools", () => {
    expect(Object.keys(tools()).sort()).toEqual(Object.keys(TOOL_POLICY).sort());
  });

  it("labels every tool with a title and read-only or destructive", () => {
    for (const [name, tool] of Object.entries(tools())) {
      const a = tool.annotations ?? {};
      expect(tool.title, name).toBeTruthy();
      expect(a.title, name).toBe(tool.title);
      expect(a.readOnlyHint === true || a.destructiveHint === true, name).toBe(true);
      expect(a.readOnlyHint === true && a.destructiveHint === true, name).toBe(false);
    }
  });

  it("marks money movement and account changes destructive", () => {
    for (const name of [
      "create_transfer",
      "create_quote",
      "create_customer",
      "update_route_destination",
      "delete_webhook",
      "create_api_key",
    ]) {
      expect(annotationsFor(TOOL_POLICY[name]).destructiveHint, name).toBe(true);
    }
    expect(annotationsFor(TOOL_POLICY.create_transfer).openWorldHint).toBe(true);
    for (const name of ["list_customers", "get_transfer", "validate_payment_method"]) {
      expect(annotationsFor(TOOL_POLICY[name]).readOnlyHint, name).toBe(true);
    }
  });

  it("hides API key management unless admin is granted", () => {
    const limited = tools({ read: true, write: true, admin: false });
    expect(limited.create_api_key.enabled).toBe(false);
    expect(limited.revoke_api_key.enabled).toBe(false);
    expect(limited.list_api_keys.enabled).toBe(true);
    expect(tools().create_api_key.enabled).toBe(true);
  });
});
