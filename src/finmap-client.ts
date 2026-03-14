const BASE = "https://api.finmap.online/v2.2";

export class FinmapClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    let url = `${BASE}${path}`;
    if (query && Object.keys(query).length > 0) {
      url += "?" + new URLSearchParams(query).toString();
    }

    const headers: Record<string, string> = {
      apiKey: this.apiKey,
    };
    const bodyStr = body != null ? JSON.stringify(body) : undefined;
    if (bodyStr) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: bodyStr,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `Finmap ${method.toUpperCase()} ${path} → ${res.status}: ${text.slice(0, 500)}`,
      );
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  get<T = unknown>(path: string, query?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, query);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  del<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
