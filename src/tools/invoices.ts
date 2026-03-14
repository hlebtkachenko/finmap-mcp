import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";

interface InvListResult {
  list: Record<string, unknown>[];
  total: number;
}

function toTimestamp(dateStr: string): number {
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid date: "${dateStr}". Use YYYY-MM-DD format.`);
  return ms;
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${label}: ${raw.slice(0, 100)}`);
  }
}

export function registerInvoicesTools(server: McpServer, fm: FinmapClient) {
  server.tool(
    "finmap_invoices_list",
    "List/filter invoices",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      confirmedInvoice: z.boolean().optional().describe("Filter by confirmed status"),
      invoiceStatus: z.enum(["overdue", "payed", "notPayed", "all"]).optional(),
      limit: z.number().optional().default(25),
      offset: z.number().optional().default(0),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        limit: params.limit,
        offset: params.offset,
        desc: true,
        field: "date",
      };
      if (params.startDate) body.startDate = toTimestamp(params.startDate);
      if (params.endDate) body.endDate = toTimestamp(params.endDate + "T23:59:59");
      if (params.confirmedInvoice != null) body.confirmedInvoice = params.confirmedInvoice;
      if (params.invoiceStatus) body.invoiceStatus = params.invoiceStatus;

      const result = await fm.post<InvListResult>("/operations/invoices/list", body);
      if (!result.list?.length) return { content: [{ type: "text", text: "No invoices found." }] };

      const lines = [`# Invoices (${result.list.length} of ${result.total})`, ""];
      for (const inv of result.list) {
        const date = inv.date ? new Date(inv.date as number).toISOString().split("T")[0] : "?";
        const num = inv.invoiceNumber || "no number";
        const amount = inv.sum ?? "?";
        const curr = inv.invoiceCurrency || inv.currencySymbol || "";
        const paid = inv.confirmedInvoice ? "PAID" : "UNPAID";
        const party = inv.counterpartyName ? ` — ${inv.counterpartyName}` : "";
        lines.push(`- **#${num}** ${date}: ${amount} ${curr} [${paid}]${party} (id: ${inv.id})`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "finmap_invoice_detail",
    "Get invoice details by ID or external ID",
    {
      id: z.string().optional().describe("Invoice ID"),
      externalId: z.string().optional().describe("External ID"),
    },
    async ({ id, externalId }) => {
      const query: Record<string, string> = {};
      if (id) query.id = id;
      if (externalId) query.externalId = externalId;
      const result = await fm.get<InvListResult>("/operations/invoices/details", query);
      if (!result.list?.length) return { content: [{ type: "text", text: "Invoice not found." }] };
      return { content: [{ type: "text", text: `# Invoice Detail\n\`\`\`json\n${JSON.stringify(result.list[0], null, 2)}\n\`\`\`` }] };
    },
  );

  server.tool(
    "finmap_invoice_create",
    "Create a new invoice",
    {
      invoiceNumber: z.string().describe("Invoice number"),
      invoiceCompanyId: z.string().describe("Your company ID (use finmap_invoice_companies)"),
      supplierId: z.string().describe("Client/supplier ID"),
      invoiceCompanyDetails: z.string().describe("Your company details (IBAN, etc.)"),
      supplierDetails: z.string().describe("Client details (IBAN, etc.)"),
      invoiceCurrency: z.string().describe("Currency code (CZK, EUR, USD, etc.)"),
      goods: z.string().describe('JSON array of goods: [{"id":"...", "count":1, "price":100, "vat":21}]'),
      comment: z.string().optional(),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      shipping: z.number().optional().describe("Shipping cost"),
      discountPercentage: z.number().optional().describe("Discount %"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        invoiceNumber: params.invoiceNumber,
        invoiceCompanyId: params.invoiceCompanyId,
        supplierId: params.supplierId,
        invoiceCompanyDetails: params.invoiceCompanyDetails,
        supplierDetails: params.supplierDetails,
        invoiceCurrency: params.invoiceCurrency,
        goods: parseJson(params.goods, "goods"),
      };
      if (params.comment) body.comment = params.comment;
      if (params.date) body.date = toTimestamp(params.date);
      if (params.shipping != null) body.shipping = params.shipping;
      if (params.discountPercentage != null) body.discountPercentage = params.discountPercentage;

      const result = await fm.post("/invoices", body);
      return { content: [{ type: "text", text: `Invoice created.\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` }] };
    },
  );

  server.tool(
    "finmap_invoice_delete",
    "Delete an invoice by ID (careful!)",
    { id: z.string().describe("Invoice ID") },
    async ({ id }) => {
      await fm.del(`/invoices/${id}`);
      return { content: [{ type: "text", text: `Invoice ${id} deleted.` }] };
    },
  );

  server.tool("finmap_invoice_companies", "List invoice companies (your company profiles)", {}, async () => {
    const items = await fm.get<Array<{ id: string; label: string }>>("/invoices/companies");
    if (!items?.length) return { content: [{ type: "text", text: "No invoice companies." }] };
    const lines = [`# Invoice Companies (${items.length})`, ""];
    for (const c of items) lines.push(`- ${c.label} (${c.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool("finmap_invoice_goods", "List available goods/services for invoices", {}, async () => {
    const items = await fm.get<Array<{ id: string; label: string }>>("/invoices/goods");
    if (!items?.length) return { content: [{ type: "text", text: "No goods." }] };
    const lines = [`# Goods/Services (${items.length})`, ""];
    for (const g of items) lines.push(`- ${g.label} (${g.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool(
    "finmap_api_raw",
    "Call any Finmap API endpoint directly (advanced)",
    {
      method: z.enum(["GET", "POST", "PATCH", "DELETE"]).default("GET"),
      path: z.string().describe("API path after /v2.2 (e.g. /accounts, /operations/list)"),
      body: z.string().optional().describe("JSON body for POST/PATCH"),
      query: z.record(z.string()).optional(),
    },
    async ({ method, path, body, query }) => {
      const parsed = body ? parseJson(body, "body") : undefined;
      let result: unknown;
      switch (method) {
        case "GET": result = await fm.get(path, query); break;
        case "POST": result = await fm.post(path, parsed); break;
        case "PATCH": result = await fm.patch(path, parsed); break;
        case "DELETE": result = await fm.del(path); break;
      }
      return { content: [{ type: "text", text: `# ${method} ${path}\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` }] };
    },
  );
}
