import { createServer } from "node:http";

import { getConfig } from "./config.js";
import { runDailyRefresh, runItemDetailRefresh } from "./service.js";

function json(statusCode: number, payload: unknown) {
  return {
    statusCode,
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  };
}

function unauthorized() {
  return json(401, { error: "Unauthorized ingest request." });
}

function notFound() {
  return json(404, { error: "Not found." });
}

function formatErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function handleRequest(request: import("node:http").IncomingMessage) {
  const config = getConfig();
  const secret = request.headers["x-ingest-secret"];
  if (secret !== config.sharedSecret) {
    return unauthorized();
  }

  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    return json(200, {
      ok: true,
      service: "funding-ops-ingest"
    });
  }

  if (request.method === "POST" && url.pathname === "/jobs/daily-refresh") {
    const body = await readBody(request);
    const triggeredBy =
      typeof body.triggeredBy === "string" && body.triggeredBy.trim().length > 0
        ? body.triggeredBy
        : "manual";

    const result = await runDailyRefresh(triggeredBy);
    return json(200, result);
  }

  if (request.method === "POST" && url.pathname.startsWith("/jobs/item/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 4 && parts[0] === "jobs" && parts[1] === "item" && parts[3] === "detail-refresh") {
      const feedItemId = parts[2];
      const result = await runItemDetailRefresh(feedItemId);
      return json(200, result);
    }
  }

  return notFound();
}

const config = getConfig();

const server = createServer(async (request, response) => {
  try {
    const result = await handleRequest(request);
    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    const detail = formatErrorDetail(error);
    console.error("Ingest service request failed:", detail);
    response.writeHead(500, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(
      JSON.stringify({
        error: "Ingest service request failed.",
        detail
      })
    );
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`funding-ops-ingest listening on ${config.port}`);
});
