// Writes src/version.ts from package.json so the version the server reports
// (MCP serverInfo, /health) can never drift from the version that is published.
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
