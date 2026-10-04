import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_VERSION } from "./version.js";

describe("SERVER_VERSION", () => {
  it("matches the version in package.json (run `npm run version:sync` if not)", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
