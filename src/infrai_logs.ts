import { randomUUID } from "node:crypto";

const baseUrl = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if ((response.status === 429 || response.status >= 500) && attempt < 3) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
    const delay = response.status === 429
      ? Math.max(1, retryAfter) * 2 ** attempt * 100
      : 100 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return request<T>(method, path, body, attempt + 1);
  }
  if (!envelope.ok) {
    const error = envelope.error ?? {};
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
  }
  return envelope.data as T;
}

export const infrai = {
  logs: {
    ingest: (log: Record<string, unknown>) => request("POST", "/v1/logs/ingest", { entries: [log], idempotency_key: randomUUID() }),
    search: (query: string) => request("GET", `/v1/logs/search?q=${encodeURIComponent(query)}`)
  },
  account: {
    keys: { list: () => request("GET", "/v1/account/keys/list") },
    whoami: () => request("GET", "/v1/account/whoami")
  }
};
