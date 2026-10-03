import { webcrypto } from "node:crypto";

// Mirrors the guard in src/serve.ts: Node 18 has no global `crypto`, and the
// handler tests exercise the MCP transport, which calls crypto.randomUUID().
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
