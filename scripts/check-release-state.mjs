#!/usr/bin/env node
/**
 * Fails when what people actually run has fallen behind main.
 *
 * Three places carry this server, and each has gone stale without anyone
 * noticing: the 2.2.2 release published nothing to npm because package.json was
 * never bumped, and the hosted Worker was redeployed by hand from main while npm
 * stayed two fixes behind. This checks all three against each other:
 *
 *   1. npm `latest` matches package.json on main, and main has no src/ changes
 *      older than the grace period that never made it into a published version.
 *   2. The latest GitHub Release actually reached npm.
 *   3. The hosted server at mcp.stables.money reports the same version and
 *      still answers GET /mcp with 405 (the reconnect-loop guard).
 *
 * Needs full git history and tags (actions/checkout with fetch-depth: 0).
 * GITHUB_TOKEN is optional; it only lifts the API rate limit.
 *
 * Run: npm run check:release
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PACKAGE = "stables-mcp-server";
const REPO = "stables-money/mcp-server";
const HOSTED_URL = process.env.STABLES_MCP_URL || "https://mcp.stables.money/mcp";
const GRACE_DAYS = Number(process.env.RELEASE_GRACE_DAYS ?? 3);

const { version: mainVersion } = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const stripV = (tag) => tag.replace(/^v/, "");

// 1. npm against main
const distTags = await fetch(`https://registry.npmjs.org/-/package/${PACKAGE}/dist-tags`).then(
  (r) => r.json()
);
const npmVersion = distTags.latest;
console.log(`main package.json: ${mainVersion}   npm latest: ${npmVersion}`);

if (npmVersion !== mainVersion) {
  problems.push(
    `npm latest is ${npmVersion} but main is at ${mainVersion}: the version was bumped and never published.`
  );
}

const publishedTag = [`v${npmVersion}`, npmVersion].find((tag) => {
  try {
    git("rev-parse", "--verify", "--quiet", `refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
});

if (!publishedTag) {
  problems.push(
    `No git tag for the published version ${npmVersion}; cannot tell what npm carries.`
  );
} else {
  const unreleased = git("log", "--format=%H %ct %s", `${publishedTag}..HEAD`, "--", "src")
    .split("\n")
    .filter(Boolean);
  if (unreleased.length > 0) {
    const oldest = Number(unreleased.at(-1).split(" ")[1]) * 1000;
    const ageDays = (Date.now() - oldest) / 86_400_000;
    const summary = unreleased
      .map((line) => `    ${line.split(" ").slice(2).join(" ")}`)
      .join("\n");
    const message = `${unreleased.length} commit(s) touching src/ since ${publishedTag} are not on npm (oldest ${ageDays.toFixed(1)} days):\n${summary}`;
    if (ageDays > GRACE_DAYS) problems.push(message);
    else console.log(`Within the ${GRACE_DAYS}-day grace period: ${message}`);
  }
}

// 2. The latest GitHub Release reached npm
const headers = process.env.GITHUB_TOKEN
  ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {};
const release = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
  headers,
}).then((r) => r.json());
if (release.tag_name) {
  console.log(`latest GitHub Release: ${release.tag_name}`);
  if (stripV(release.tag_name) !== npmVersion) {
    problems.push(
      `GitHub Release ${release.tag_name} never reached npm (latest is ${npmVersion}). Check the "Publish to npm and the MCP Registry" run for that release.`
    );
  }
} else {
  problems.push(`Could not read the latest GitHub Release: ${release.message ?? "no tag_name"}`);
}

// 3. The hosted server
try {
  const init = await fetch(HOSTED_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      // initialize needs a well-formed key, not a valid one; no API call is made.
      authorization: "Bearer sti_test_freshness_check",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "release-state-check", version: "0" },
      },
    }),
  }).then((r) => r.json());
  const hostedVersion = init.result?.serverInfo?.version;
  console.log(`hosted ${HOSTED_URL}: ${hostedVersion}`);
  if (hostedVersion !== mainVersion) {
    problems.push(
      `Hosted server reports ${hostedVersion}, main is at ${mainVersion}. Run "Deploy hosted server".`
    );
  }

  const get = await fetch(HOSTED_URL, { headers: { accept: "text/event-stream" } });
  await get.body?.cancel();
  if (get.status !== 405) {
    problems.push(
      `GET ${HOSTED_URL} answered ${get.status}, expected 405. Clients will reconnect in a loop and burn the Workers quota.`
    );
  }
} catch (error) {
  problems.push(`Could not reach the hosted server: ${error.message}`);
}

if (problems.length > 0) {
  console.error(`\nRelease state: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log("\nnpm, the latest GitHub Release and the hosted server all match main.");
