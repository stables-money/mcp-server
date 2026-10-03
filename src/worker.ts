/**
 * Cloudflare Worker entry point for the hosted Stables MCP server.
 *
 * Deployed with `npm run deploy:worker` (see wrangler.toml). The Worker owns
 * no secrets: every request authenticates with the caller's own API key.
 */

import { handleRequest } from "./http/handler.js";

export default {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
