import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The OAuth provider imports this Workers-only module; see the stub.
      "cloudflare:workers": fileURLToPath(new URL("./test/cloudflare-workers-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Inline the provider so the alias above applies to its imports too
    // (externalised dependencies resolve with Node's loader, which rejects
    // the cloudflare: scheme).
    server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
