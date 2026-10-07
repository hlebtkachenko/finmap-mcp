// End-to-end tests: the built server (dist/) talks to a fake Finmap API over HTTP.
// Run with `npm test` (builds first). All data here is synthetic.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startFakeFinmap } from "../scripts/fake-finmap.mjs";

const fake = await startFakeFinmap();
let client;

before(async () => {
  client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    // A non-UTC zone makes local-time date handling visible.
    env: { FINMAP_API_KEY: "test-key", FINMAP_API_URL: fake.url, TZ: "America/New_York" },
  }));
});

after(async () => {
  await client?.close();
  fake.close();
});

beforeEach(() => fake.reset());

const call = (name, args = {}) => client.callTool({ name, arguments: args });
const text = (r) => r.content.map((c) => c.text).join("\n");
const last = () => fake.requests.at(-1);

const DAY = Date.UTC(2026, 0, 15);

// Every tool: the exact request it sends (method, path, query, body).
const CASES = [
  ["finmap_accounts", {}, { method: "GET", path: "/v2.2/accounts", query: { withBalances: "true" } }],
  ["finmap_categories_income", {}, { method: "GET", path: "/v2.2/categories/income" }],
  ["finmap_categories_expense", {}, { method: "GET", path: "/v2.2/categories/expense" }],
  ["finmap_projects", {}, { method: "GET", path: "/v2.2/projects" }],
  ["finmap_tags", {}, { method: "GET", path: "/v2.2/tags" }],
  ["finmap_currencies", {}, { method: "GET", path: "/v2.2/currencies" }],
  ["finmap_suppliers", {}, { method: "GET", path: "/v2.2/suppliers" }],
  ["finmap_counterparties", { type: "debitors" }, { method: "GET", path: "/v2.2/debitors" }],
  ["finmap_counterparties", { type: "tax-organisations" }, { method: "GET", path: "/v2.2/tax-organisations" }],
  ["finmap_project_create", { label: "Synthetic project" }, { method: "POST", path: "/v2.2/projects", body: { label: "Synthetic project" } }],
  ["finmap_tag_create", { label: "Synthetic tag" }, { method: "POST", path: "/v2.2/tags", body: { label: "Synthetic tag" } }],
  ["finmap_operations_list", {
    types: ["income"], startDate: "2026-01-15", endDate: "2026-01-15", search: "rent",
    accountIds: ["a1"], categoryIds: ["c1"], projectIds: ["p1"], tagIds: ["t1"], counterpartyIds: ["k1"],
    limit: 10, offset: 5, desc: false,
  }, {
    method: "POST", path: "/v2.2/operations/list",
    body: {
      limit: 10, offset: 5, desc: false, field: "date", types: ["income"],
      startDate: DAY, endDate: DAY + 86_400_000 - 1, search: "rent",
      accountIds: ["a1"], categoryIds: ["c1"], projectIds: ["p1"], tagIds: ["t1"], counterpartyIds: ["k1"],
    },
  }],
  ["finmap_operation_detail", { id: "op1", externalId: "ext-1" }, { method: "GET", path: "/v2.2/operations/details", query: { id: "op1", externalId: "ext-1" } }],
  ["finmap_income_create", {
    amount: 100, accountToId: "a1", categoryId: "c1", comment: "Synthetic", date: "2026-01-15",
    projectId: "p1", tagIds: ["t1"], counterpartyId: "k1", externalId: "ext-1",
  }, {
    method: "POST", path: "/v2.2/operations/income",
    body: { amount: 100, accountToId: "a1", categoryId: "c1", comment: "Synthetic", date: DAY, projectId: "p1", tagIds: ["t1"], counterpartyId: "k1", externalId: "ext-1" },
  }],
  ["finmap_expense_create", {
    amount: 50, accountFromId: "a1", categoryId: "c1", comment: "Synthetic", date: "2026-01-15",
    projectId: "p1", tagIds: ["t1"], counterpartyId: "k1", externalId: "ext-2",
  }, {
    method: "POST", path: "/v2.2/operations/expense",
    body: { amount: 50, accountFromId: "a1", categoryId: "c1", comment: "Synthetic", date: DAY, projectId: "p1", tagIds: ["t1"], counterpartyId: "k1", externalId: "ext-2" },
  }],
  ["finmap_transfer_create", {
    amount: 10, accountFromId: "a1", accountToId: "a2", amountTo: 9, comment: "Synthetic", date: "2026-01-15", externalId: "ext-3",
  }, {
    method: "POST", path: "/v2.2/operations/transfer",
    body: { amount: 10, accountFromId: "a1", accountToId: "a2", amountTo: 9, comment: "Synthetic", date: DAY, externalId: "ext-3" },
  }],
  ["finmap_operation_delete", { type: "expense", id: "op1" }, { method: "DELETE", path: "/v2.2/operations/expense/op1" }],
  ["finmap_invoices_list", {
    startDate: "2026-01-15", endDate: "2026-01-15", confirmedInvoice: true, invoiceStatus: "overdue", limit: 10, offset: 0,
  }, {
    method: "POST", path: "/v2.2/operations/invoices/list",
    body: { limit: 10, offset: 0, desc: true, field: "date", startDate: DAY, endDate: DAY + 86_400_000 - 1, confirmedInvoice: true, invoiceStatus: "overdue" },
  }],
  ["finmap_invoice_detail", { externalId: "ext-4" }, { method: "GET", path: "/v2.2/operations/invoices/details", query: { externalId: "ext-4" } }],
  ["finmap_invoice_create", {
    invoiceNumber: "2026-001", invoiceCompanyId: "co1", supplierId: "s1", invoiceCompanyDetails: "IBAN X", supplierDetails: "IBAN Y",
    invoiceCurrency: "CZK", goods: [{ id: "g1", count: 2, price: 10, vat: 21 }], comment: "Synthetic", date: "2026-01-15",
    shipping: 5, discountPercentage: 10, externalId: "ext-4",
  }, {
    method: "POST", path: "/v2.2/invoices",
    body: {
      invoiceNumber: "2026-001", invoiceCompanyId: "co1", supplierId: "s1", invoiceCompanyDetails: "IBAN X", supplierDetails: "IBAN Y",
      invoiceCurrency: "CZK", goods: [{ id: "g1", count: 2, price: 10, vat: 21 }], comment: "Synthetic", date: DAY,
      shipping: 5, discountPercentage: 10, externalId: "ext-4",
    },
  }],
  ["finmap_invoice_delete", { id: "inv1" }, { method: "DELETE", path: "/v2.2/invoices/inv1" }],
  ["finmap_invoice_companies", {}, { method: "GET", path: "/v2.2/invoices/companies" }],
  ["finmap_invoice_goods", {}, { method: "GET", path: "/v2.2/invoices/goods" }],
  ["finmap_api_raw", { method: "PATCH", path: "/tags/t1", body: '{"label":"Renamed"}' }, { method: "PATCH", path: "/v2.2/tags/t1", body: { label: "Renamed" } }],
];

test("every tool sends the exact request", async () => {
  for (const [name, args, want] of CASES) {
    fake.reset();
    const r = await call(name, args);
    assert.ok(!r.isError, `${name}: ${text(r)}`);
    assert.equal(fake.requests.length, 1, name);
    const got = last();
    assert.equal(got.method, want.method, name);
    assert.equal(got.path, want.path, name);
    assert.deepEqual(got.query, want.query ?? {}, name);
    assert.deepEqual(got.body, want.body, name);
    assert.equal(got.headers.apikey, "test-key", name);
  }
});

test("every registered tool is covered by the request test", async () => {
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual([...new Set(CASES.map(([n]) => n))].sort(), names);
});

// Finding 1: deletes report the OperationInsertStatus they get back.
test("delete returns isError on status Error and pending on Stored/queued", async () => {
  fake.respond("DELETE", "/v2.2/invoices/inv1", { status: "Error", statusCode: "3" });
  const bad = await call("finmap_invoice_delete", { id: "inv1" });
  assert.ok(bad.isError, text(bad));

  fake.respond("DELETE", "/v2.2/operations/income/op1", { status: "Stored", statusCode: "2" });
  const stored = await call("finmap_operation_delete", { type: "income", id: "op1" });
  assert.ok(!stored.isError);
  assert.match(text(stored), /not processed yet/);
  assert.doesNotMatch(text(stored), /deleted\./);

  fake.respond("DELETE", "/v2.2/operations/income/op1", { status: "Processed now", statusCode: "1" });
  const ok = await call("finmap_operation_delete", { type: "income", id: "op1" });
  assert.ok(!ok.isError);
  assert.match(text(ok), /deleted/i);
});

// Finding 2: creates report the OperationInsertStatus they get back.
test("create returns isError on status Error and pending on queued", async () => {
  fake.respond("POST", "/v2.2/operations/income", { status: "Error", statusCode: "3" });
  const bad = await call("finmap_income_create", { amount: 1, accountToId: "a1" });
  assert.ok(bad.isError, text(bad));

  fake.respond("POST", "/v2.2/invoices", { status: "In the queue for processing", statusCode: "0" });
  const queued = await call("finmap_invoice_create", {
    invoiceNumber: "1", invoiceCompanyId: "co1", supplierId: "s1", invoiceCompanyDetails: "x", supplierDetails: "y",
    invoiceCurrency: "CZK", goods: [{ id: "g1", count: 1, price: 1, vat: 0 }],
  });
  assert.ok(!queued.isError);
  assert.match(text(queued), /not processed yet/);
  assert.doesNotMatch(text(queued), /Invoice created\./);
});

test("unrecognised write response is an outcome-unknown error", async () => {
  fake.respond("POST", "/v2.2/operations/transfer", { something: "else" });
  const r = await call("finmap_transfer_create", { amount: 1, accountFromId: "a1", accountToId: "a2", externalId: "ext-9" });
  assert.ok(r.isError);
  assert.match(text(r), /outcome unknown/i);
  assert.match(text(r), /finmap_operation_detail/);
});

test("write with no response is an outcome-unknown error, never retried", async () => {
  fake.respond("POST", "/v2.2/operations/expense", "DROP");
  const r = await call("finmap_expense_create", { amount: 1, accountFromId: "a1", externalId: "ext-8" });
  assert.ok(r.isError);
  assert.match(text(r), /outcome unknown/i);
  assert.equal(fake.requests.length, 1);
});

// Finding 3: confirmedInvoice is a confirmation flag, not a payment state.
test("invoice list labels confirmation, not payment", async () => {
  fake.respond("POST", "/v2.2/operations/invoices/list", {
    list: [{ id: "i1", invoiceNumber: "2026-001", date: DAY, sum: 10, invoiceCurrency: "CZK", confirmedInvoice: true }],
    total: 1,
  });
  const r = await call("finmap_invoices_list", {});
  assert.match(text(r), /CONFIRMED/);
  assert.doesNotMatch(text(r), /PAID/);
});

// Finding 4: every tool carries MCP annotations.
test("every tool is annotated", async () => {
  const { tools } = await client.listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations ?? {}]));
  for (const t of tools) {
    const a = t.annotations ?? {};
    assert.equal(typeof a.readOnlyHint, "boolean", t.name);
    if (!a.readOnlyHint) assert.equal(typeof a.destructiveHint, "boolean", t.name);
  }
  for (const n of ["finmap_operation_delete", "finmap_invoice_delete", "finmap_api_raw"]) assert.equal(byName[n].destructiveHint, true, n);
  for (const n of ["finmap_income_create", "finmap_expense_create", "finmap_transfer_create", "finmap_invoice_create"]) {
    assert.equal(byName[n].destructiveHint, false, n);
  }
  assert.equal(byName.finmap_api_raw.openWorldHint, true);
  assert.equal(byName.finmap_accounts.readOnlyHint, true);
});

// Finding 5: externalId makes create retries safe.
test("create tools accept externalId and explain a 409 duplicate", async () => {
  const r = await call("finmap_income_create", { amount: 1, accountToId: "a1", externalId: "ext-1" });
  assert.equal(last().body.externalId, "ext-1");
  assert.match(text(r), /ext-1/);

  fake.respond("POST", "/v2.2/operations/income", { status: 409, body: { message: "Item already exist." } });
  const dup = await call("finmap_income_create", { amount: 1, accountToId: "a1", externalId: "ext-1" });
  assert.ok(dup.isError);
  assert.match(text(dup), /already exists/i);
});

// Finding 6: ids in paths are URL-encoded.
test("path ids are URL-encoded", async () => {
  await call("finmap_invoice_delete", { id: "a/b?c" });
  assert.equal(last().rawPath, "/v2.2/invoices/a%2Fb%3Fc");
  await call("finmap_operation_delete", { type: "income", id: "../x" });
  assert.equal(last().rawPath, "/v2.2/operations/income/..%2Fx");
});

// Finding 7: date windows are whole UTC days regardless of the server time zone.
test("date window is the whole UTC day", async () => {
  await call("finmap_operations_list", { startDate: "2026-01-15", endDate: "2026-01-15" });
  assert.equal(last().body.startDate, DAY);
  assert.equal(last().body.endDate, DAY + 86_400_000 - 1);
  const bad = await call("finmap_operations_list", { startDate: "2026-02-30" });
  assert.ok(bad.isError);
});

// Finding 8: suppliers are one counterparty type; the others have their own lister.
test("counterparty lister covers every counterparty endpoint", async () => {
  const { tools } = await client.listTools();
  const suppliers = tools.find((t) => t.name === "finmap_suppliers");
  assert.doesNotMatch(suppliers.description, /suppliers\/counterparties/i);
  assert.match(suppliers.description, /finmap_counterparties/);
  const cp = tools.find((t) => t.name === "finmap_counterparties");
  assert.deepEqual(
    [...cp.inputSchema.properties.type.enum].sort(),
    ["creditors", "debitors", "employees", "investors", "owners", "suppliers", "tax-organisations"],
  );
  fake.respond("GET", "/v2.2/owners", [{ id: "o1", label: "Synthetic owner", parentId: "" }]);
  const r = await call("finmap_counterparties", { type: "owners" });
  assert.match(text(r), /Synthetic owner \(o1\)/);
});

// Finding 9: the README matches the code.
test("README lists exactly the registered tools and makes no full-coverage claim", async () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  const documented = [...new Set([...readme.matchAll(/^\| `(finmap_\w+)` \|/gm)].map((m) => m[1]))].sort();
  assert.deepEqual(documented, names);
  assert.doesNotMatch(readme, /full Finmap API/i);
  assert.match(readme, new RegExp(`\\b${names.length} tools\\b`));
});

test("list tools return isError instead of an empty list on a non-list body", async () => {
  fake.respond("GET", "/v2.2/tags", { error: "Synthetic failure" });
  const tags = await call("finmap_tags");
  assert.ok(tags.isError, text(tags));
  fake.respond("POST", "/v2.2/operations/list", { error: "Synthetic failure" });
  const ops = await call("finmap_operations_list", {});
  assert.ok(ops.isError, text(ops));
});

test("HTTP errors reach the model as isError", async () => {
  fake.respond("GET", "/v2.2/accounts", { status: 401, body: { message: "Unauthorized" } });
  const r = await call("finmap_accounts");
  assert.ok(r.isError);
  assert.match(text(r), /401/);
});

test("raw tool flags an Error status inside a 2xx body and passes query on every method", async () => {
  fake.respond("DELETE", "/v2.2/tags/t1", { status: "Error", statusCode: "3" });
  const r = await call("finmap_api_raw", { method: "DELETE", path: "/tags/t1" });
  assert.ok(r.isError);
  await call("finmap_api_raw", { method: "POST", path: "/operations/income", body: "{}", query: { offset: "0" } });
  assert.deepEqual(last().query, { offset: "0" });
  const rel = await call("finmap_api_raw", { method: "GET", path: "tags" });
  assert.ok(rel.isError);
});
