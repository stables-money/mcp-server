// Writes src/version.ts from package.json so the version the server reports
// (MCP serverInfo, /health) can never drift from the version that is published,
// and keeps server.json (the MCP Registry listing) on the same version.
// Runs before every build and Worker deploy, and from the `npm version` hook.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const target = join(root, "src", "version.ts");
const contents = `// Generated from package.json by scripts/write-version.mjs. Do not edit.
export const SERVER_VERSION = "${version}";
`;

if (!existsSync(target) || readFileSync(target, "utf8") !== contents) {
  writeFileSync(target, contents);
  console.log(`src/version.ts -> ${version}`);
}

// MCP Registry listing: top-level version and the npm package version.
const serverJsonPath = join(root, "server.json");
if (existsSync(serverJsonPath)) {
  const raw = readFileSync(serverJsonPath, "utf8");
  const listing = JSON.parse(raw);
  listing.version = version;
  for (const pkg of listing.packages ?? []) {
    if (pkg.registryType === "npm") pkg.version = version;
  }
  const next = JSON.stringify(listing, null, 2) + "\n";
  if (next !== raw) {
    writeFileSync(serverJsonPath, next);
    console.log(`server.json -> ${version}`);
  }
}
