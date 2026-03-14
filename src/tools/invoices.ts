import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";

function fmt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

interface InvListResult {
  list: Record<string, unknown>[];
  total: number;
}

export function registerInvoicesTools(server: McpServer, fm: FinmapClient) {
  server.tool(
    "finmap_invoices_list",
    "List/filter invoices",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      confirmedInvoice: z.boolean().optional().describe("Filter by confirmed status"),
      invoiceStatus: z.enum(["overdue", "payed", "notPayed", "all"]).optional().describe("Invoice status filter"),
      limit: z.number().optional().default(25).describe("Max results"),
      offset: z.number().optional().default(0).describe("Offset"),
    },
    async (params) => {
      const body: Record<string, unknown> = {
        limit: params.limit,
        offset: params.offset,
        desc: true,
        field: "date",
      };
      if (params.startDate) body.startDate = new Date(params.startDate).getTime();
      if (params.endDate) body.endDate = new Date(params.endDate + "T23:59:59").getTime();
      if (params.confirmedInvoice != null) body.confirmedInvoice = params.confirmedInvoice;
      if (params.invoiceStatus) body.invoiceStatus = params.invoiceStatus;

      const result = await fm.post<InvListResult>("/operations/invoices/list", body);
      if (!result.list?.length) return { content: [{ type: "text", text: "No invoices found." }] };

      const lines = [`# Invoices (showing ${result.list.length} of ${result.total})`, ""];
      for (const inv of result.list) {
        const date = inv.date ? new Date(inv.date as number).toISOString().split("T")[0] : "?";
        const num = inv.invoiceNumber || "no number";
        const amount = inv.sum ?? "?";
        const curr = inv.invoiceCurrency || inv.currencySymbol || "";
        const confirmed = inv.confirmedInvoice ? "PAID" : "UNPAID";
        const counterparty = inv.counterpartyName ? ` — ${inv.counterpartyName}` : "";
        lines.push(`- **#${num}** ${date}: ${amount} ${curr} [${confirmed}]${counterparty} (id: ${inv.id})`);
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
      return { content: [{ type: "text", text: `# Invoice Detail\n\n\`\`\`json\n${fmt(result.list[0])}\n\`\`\`` }] };
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
      goods: z.string().describe("JSON array of goods: [{id, count, price, vat}]"),
      comment: z.string().optional().describe("Comment"),
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
        goods: JSON.parse(params.goods),
      };
      if (params.comment) body.comment = params.comment;
      if (params.date) body.date = new Date(params.date).getTime();
      if (params.shipping != null) body.shipping = params.shipping;
      if (params.discountPercentage != null) body.discountPercentage = params.discountPercentage;

      const result = await fm.post("/invoices", body);
      return { content: [{ type: "text", text: `Invoice created.\n\n\`\`\`json\n${fmt(result)}\n\`\`\`` }] };
    },
  );

  server.tool(
    "finmap_invoice_delete",
    "Delete an invoice by ID (careful!)",
    { id: z.string().describe("Invoice ID") },
    async ({ id }) => {
      const result = await fm.del(`/invoices/${id}`);
      return { content: [{ type: "text", text: `Invoice ${id} deleted.\n\n\`\`\`json\n${fmt(result)}\n\`\`\`` }] };
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
    const lines = [`# Invoice Goods (${items.length})`, ""];
    for (const g of items) lines.push(`- ${g.label} (${g.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool(
    "finmap_api_raw",
    "Call any Finmap API endpoint directly. See https://api.finmap.online/ for all endpoints.",
    {
      method: z.enum(["GET", "POST", "PATCH", "DELETE"]).default("GET"),
      path: z.string().describe("API path after /v2.2 (e.g. /accounts, /operations/list)"),
      body: z.string().optional().describe("JSON body for POST/PATCH"),
      query: z.record(z.string()).optional().describe("Query parameters"),
    },
    async ({ method, path, body, query }) => {
      const parsedBody = body ? JSON.parse(body) : undefined;
      const result = method === "GET"
        ? await fm.get(path, query)
        : method === "DELETE"
          ? await fm.del(path)
          : method === "PATCH"
            ? await fm.patch(path, parsedBody)
            : await fm.post(path, parsedBody);
      return { content: [{ type: "text", text: `# ${method} ${path}\n\n\`\`\`json\n${fmt(result)}\n\`\`\`` }] };
    },
  );
}
