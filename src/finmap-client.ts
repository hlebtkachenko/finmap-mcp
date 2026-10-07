export const DEFAULT_BASE_URL = "https://api.finmap.online/v2.2";
const TIMEOUT_MS = 30_000;

/** HTTP or transport failure. outcomeUnknown: a write may or may not have been applied. */
export class FinmapError extends Error {
  constructor(message: string, readonly status?: number, readonly outcomeUnknown = false) {
    super(message);
  }
}

export class FinmapClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = DEFAULT_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query && Object.keys(query).length > 0) {
      url += "?" + new URLSearchParams(query).toString();
    }

    const verb = method.toUpperCase();
    const isWrite = verb !== "GET";
    const label = `Finmap ${verb} ${path}`;
    const headers: Record<string, string> = { apiKey: this.apiKey };
    const bodyStr = body != null ? JSON.stringify(body) : undefined;
    if (bodyStr) headers["Content-Type"] = "application/json";

    // No retries: a repeated POST could create a duplicate record.
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, { method: verb, headers, body: bodyStr, signal: AbortSignal.timeout(TIMEOUT_MS) });
      text = await res.text();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new FinmapError(
        isWrite ? `${label}: no response (${reason}); outcome unknown.` : `${label}: ${reason}`,
        undefined,
        isWrite,
      );
    }

    if (!res.ok) {
      const unknown = isWrite && res.status >= 500;
      throw new FinmapError(
        `${label} → ${res.status}: ${text.slice(0, 500)}${unknown ? " (outcome unknown)" : ""}`,
        res.status,
        unknown,
      );
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FinmapError(`${label}: response is not JSON: ${text.slice(0, 200)}`, res.status, isWrite);
    }
  }

  get<T = unknown>(path: string, query?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, query);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  del<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
