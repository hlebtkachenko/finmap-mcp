// Fake Finmap API for tests and the contract check. Records every request; canned responses
// follow the spec shapes. respond(method, path, value) overrides one route until reset():
// a plain value is sent as 2xx JSON, { status, body } sets the HTTP status, "DROP" closes the socket.
import http from "node:http";

const OK = { status: "Processed now", statusCode: "1" };

function defaultResponse(method, path) {
  if (method === "DELETE") return OK;
  if (method === "PATCH") return OK;
  if (path.endsWith("/list")) return { list: [], total: 0 };
  if (path.endsWith("/details")) return { list: [{ id: "x1" }], total: 1 };
  if (method === "POST" && (path.endsWith("/projects") || path.endsWith("/tags"))) return { id: "new1", label: "Synthetic", parentId: "" };
  if (method === "POST") return OK;
  return [];
}

export async function startFakeFinmap() {
  const requests = [];
  let overrides = new Map();
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const raw = Buffer.concat(chunks).toString("utf8");
      const path = decodeURIComponent(url.pathname);
      requests.push({
        method: req.method,
        rawPath: url.pathname,
        path,
        query: Object.fromEntries(url.searchParams),
        body: raw ? JSON.parse(raw) : undefined,
        headers: req.headers,
      });
      const key = `${req.method} ${url.pathname}`;
      const value = overrides.has(key) ? overrides.get(key) : defaultResponse(req.method, path);
      if (value === "DROP") return req.socket.destroy();
      const isEnvelope = value && typeof value === "object" && !Array.isArray(value) && typeof value.status === "number";
      const status = isEnvelope ? value.status : req.method === "POST" && !path.endsWith("/list") ? 201 : 200;
      const body = isEnvelope ? value.body : value;
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}/v2.2`,
    requests,
    respond: (method, path, value) => overrides.set(`${method} ${path}`, value),
    reset: () => { requests.length = 0; overrides = new Map(); },
    close: () => server.close(),
  };
}
