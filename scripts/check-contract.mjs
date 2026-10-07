// Validates the request every tool sends against Finmap's published OpenAPI spec.
// Calls each tool twice (all fields filled, required fields only; each value of a required enum)
// against a fake Finmap API, captures the request and checks method + path, query parameters
// and the JSON body against the operation's requestBody schema (ajv).
// Usage: npm run check:contract   (the spec is cached in .spec-cache/)
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startFakeFinmap } from "./fake-finmap.mjs";

const SPEC_URL = "https://api.finmap.online/json";
const CACHE = path.resolve(".spec-cache");
const SPEC_FILE = path.join(CACHE, "finmap-openapi.json");
const SKIP = new Set(["finmap_api_raw"]);

async function loadSpec() {
  if (!fs.existsSync(SPEC_FILE)) {
    fs.mkdirSync(CACHE, { recursive: true });
    const resp = await fetch(SPEC_URL);
    if (!resp.ok) throw new Error(`Cannot download ${SPEC_URL}: HTTP ${resp.status}`);
    fs.writeFileSync(SPEC_FILE, await resp.text());
  }
  return JSON.parse(fs.readFileSync(SPEC_FILE, "utf8"));
}

// The spec declares no additionalProperties, so a misspelled field would validate. Close every object.
function closeObjects(node) {
  if (Array.isArray(node)) return node.forEach(closeObjects);
  if (!node || typeof node !== "object") return;
  if (node.properties && node.additionalProperties === undefined) node.additionalProperties = false;
  Object.values(node).forEach(closeObjects);
}

function sample(schema, key = "") {
  if (/date/i.test(key)) return "2026-01-15";
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sample(schema.anyOf[0], key);
  switch (schema.type) {
    case "string": return "X1";
    case "number": case "integer": return Math.max(1, schema.minimum ?? 1);
    case "boolean": return true;
    case "array": return [sample(schema.items)];
    case "object": return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, sample(v, k)]));
    default: return "X1";
  }
}

const spec = await loadSpec();
const components = structuredClone(spec.components);
// Spec bug: InvoiceOperationDto.goods declares items as strings, but its own example and description
// send objects with id or label, count, price, vat. Validate against the documented object shape.
components.schemas.InvoiceOperationDto.properties.goods.items = {
  type: "object",
  properties: { id: { type: "string" }, label: { type: "string" }, count: { type: "number" }, price: { type: "number" }, vat: { type: "number" } },
  required: ["count", "price", "vat"],
};
closeObjects(components);
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema({ $id: "spec", components });

// One route per spec operation, with ajv validators for its query string and JSON body.
// Query values arrive as strings, so the query validator coerces types. A route without a
// requestBody accepts only "no body" (null).
const queryAjv = new Ajv({ strict: false, allErrors: true, coerceTypes: true });
queryAjv.addSchema({ $id: "spec", components });
const routes = Object.entries(spec.paths).flatMap(([p, ops]) =>
  Object.entries(ops).map(([method, op]) => {
    const query = (op.parameters ?? []).filter((x) => x.in === "query");
    const body = op.requestBody?.content?.["application/json"]?.schema;
    return {
      method: method.toUpperCase(),
      re: new RegExp(`^${p.replace(/\{[^}]+\}/g, "[^/]+")}$`),
      query: queryAjv.compile({
        type: "object",
        properties: Object.fromEntries(query.map((x) => [x.name, x.schema ?? {}])),
        required: query.filter((x) => x.required).map((x) => x.name),
        additionalProperties: false,
      }),
      body: ajv.compile(body ? { $ref: `spec${body.$ref}` } : { type: "null" }),
    };
  }));

const describe = (where, errors) => errors.map((e) =>
  `${where}${e.instancePath} ${e.message}${e.params?.additionalProperty ? `: ${e.params.additionalProperty}` : ""}`);

function check(req) {
  const route = routes.find((r) => r.method === req.method && r.re.test(req.rawPath));
  if (!route) return [`no ${req.method} ${req.rawPath} in the spec`];
  return [
    ...(route.query({ ...req.query }) ? [] : describe("query", route.query.errors)),
    ...(route.body(req.body ?? null) ? [] : describe("body", route.body.errors)),
  ];
}

const fake = await startFakeFinmap();
const client = new Client({ name: "check-contract", version: "0" });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: { FINMAP_API_KEY: "check-key", FINMAP_API_URL: fake.url },
}));

let failed = 0;
const { tools } = await client.listTools();
for (const tool of tools) {
  if (SKIP.has(tool.name)) continue;
  const full = sample(tool.inputSchema);
  const required = Object.fromEntries(Object.entries(full).filter(([k]) => tool.inputSchema.required?.includes(k)));
  const [variantKey, variantSchema] = Object.entries(tool.inputSchema.properties ?? {})
    .find(([k, v]) => v.enum && tool.inputSchema.required?.includes(k)) ?? [];
  for (const [kind, base] of [["full", full], ["required", required]]) {
    for (const v of variantKey ? variantSchema.enum : [undefined]) {
      const args = variantKey ? { ...base, [variantKey]: v } : base;
      const label = `${tool.name}${variantKey ? ` ${variantKey}=${v}` : ""} (${kind})`;
      fake.reset();
      await client.callTool({ name: tool.name, arguments: args });
      if (!fake.requests.length) {
        console.log(`SKIP ${label}: no request sent`);
        continue;
      }
      const errors = fake.requests.flatMap(check);
      if (errors.length) {
        failed++;
        console.log(`FAIL ${label}\n     ${errors.join("\n     ")}`);
      } else {
        console.log(`ok   ${label}`);
      }
    }
  }
}

await client.close();
fake.close();
console.log(failed ? `\n${failed} call(s) send requests that do not match the spec.` : "\nAll tools send spec-valid requests.");
process.exit(failed ? 1 : 0);
