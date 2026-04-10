import { getConfig } from "./config.js";

function buildHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const config = getConfig();

  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", config.userAgent);
  }

  return headers;
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.sourceTimeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers: buildHeaders(init?.headers),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function postJson<T>(url: string, body: unknown, init?: RequestInit) {
  return fetchJson<T>(url, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}
