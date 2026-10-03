#!/usr/bin/env node
/**
 * Node entry point for the hosted Stables MCP server.
 *
 * Runs the same web-standard handler as the Cloudflare Worker behind a plain
 * `node:http` server, for a container (see Dockerfile) or a local run:
 *
 *   PORT=3333 node build/serve.js
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { handleRequest } from "./http/handler.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

function toWebRequest(req: IncomingMessage): Request {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${port}`;
  const url = `${protocol}://${hostHeader}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as BodyInit) : undefined,
    // Required by undici when the body is a stream.
    ...({ duplex: "half" } as object),
  });
}

async function writeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) {
    res.end();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(response.body as unknown as import("node:stream/web").ReadableStream)
      .on("error", reject)
      .on("end", resolve)
      .pipe(res);
  });
}

const server = createServer(async (req, res) => {
  try {
    await writeWebResponse(await handleRequest(toWebRequest(req)), res);
  } catch (error) {
    process.stderr.write(`request failed: ${String(error)}\n`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
    }
    res.end(JSON.stringify({ error: "internal_error" }));
  }
});

server.listen(port, host, () => {
  process.stderr.write(`stables-mcp-server listening on http://${host}:${port}/mcp\n`);
});
