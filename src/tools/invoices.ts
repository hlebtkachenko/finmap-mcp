import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";
import {
  toBody, listBody, detailResult, textResult, errorResult, asArray, asList, json, insertStatusResult, writeErrorResult,
  READ, CREATE, DELETE, externalIdParam, created,
} from "../utils.js";

const VERIFY = "finmap_invoice_detail (externalId) or finmap_invoices_list";

function listLabeled(items: Array<{ id: string; label: string }>, title: string): string {
  if (!items.length) return `No ${title.toLowerCase()}.`;
  return [`# ${title} (${items.length})`, "", ...items.map((i) => `- ${i.label} (${i.id})`)].join("\n");
}

export function registerInvoicesTools(server: McpServer, fm: FinmapClient) {
  server.registerTool(
    "finmap_invoices_list",
    {
      description:
        "List/filter invoices. Each line shows CONFIRMED/UNCONFIRMED (the confirmedInvoice flag). " +
        "Payment state is separate: filter it with invoiceStatus (payed, notPayed, overdue). Dates are whole UTC days.",
      inputSchema: {
        startDate: z.string().optional().describe("Start date (YYYY-MM-DD, from 00:00 UTC)"),
        endDate: z.string().optional().describe("End date (YYYY-MM-DD, inclusive, to 23:59:59.999 UTC)"),
        confirmedInvoice: z.boolean().optional().describe("Filter by confirmation flag (not payment)"),
        invoiceStatus: z.enum(["overdue", "payed", "notPayed", "all"]).optional().describe("Filter by payment state"),
        limit: z.number().optional().default(25),
        offset: z.number().optional().default(0),
      },
      annotations: READ,
    },
    async (params) => {
      try {
        const body = listBody({ ...params, desc: true });
        const result = asList<Record<string, unknown>>(await fm.post("/operations/invoices/list", body), "invoices list");
        if (!result.list.length) return textResult("No invoices found.");

        const lines = [`# Invoices (${result.list.length} of ${result.total})`, ""];
        for (const inv of result.list) {
          const date = inv.date ? new Date(inv.date as number).toISOString().split("T")[0] : "?";
          const num = inv.invoiceNumber || "no number";
          const amount = inv.sum ?? "?";
          const curr = inv.invoiceCurrency || inv.currencySymbol || "";
          const confirmed = inv.confirmedInvoice ? "CONFIRMED" : "UNCONFIRMED";
          const party = inv.counterpartyName ? ` — ${inv.counterpartyName}` : "";
          lines.push(`- **#${num}** ${date}: ${amount} ${curr} [${confirmed}]${party} (id: ${inv.id})`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finmap_invoice_detail",
    {
      description: "Get invoice details by ID or external ID",
      inputSchema: {
        id: z.string().optional().describe("Invoice ID"),
        externalId: z.string().optional().describe("External ID"),
      },
      annotations: READ,
    },
    ({ id, externalId }) => detailResult(fm, "/operations/invoices/details", "Invoice", id, externalId),
  );

  server.registerTool(
    "finmap_invoice_create",
    {
      description: "Create a new invoice. Pass externalId so a retry cannot create a duplicate.",
      inputSchema: {
        invoiceNumber: z.string().describe("Invoice number"),
        invoiceCompanyId: z.string().describe("Your company ID (use finmap_invoice_companies)"),
        supplierId: z.string().describe("Client/supplier ID"),
        invoiceCompanyDetails: z.string().describe("Your company details (IBAN, etc.)"),
        supplierDetails: z.string().describe("Client details (IBAN, etc.)"),
        invoiceCurrency: z.string().describe("Currency code (CZK, EUR, USD, etc.)"),
        goods: z.array(z.object({
          id: z.string().describe("Product/service ID"),
          count: z.number().describe("Quantity"),
          price: z.number().describe("Unit price"),
          vat: z.number().describe("VAT percentage"),
        })).describe("Array of invoice line items"),
        comment: z.string().optional(),
        date: z.string().optional().describe("Date (YYYY-MM-DD, stored as 00:00 UTC)"),
        shipping: z.number().optional().describe("Shipping cost"),
        discountPercentage: z.number().min(0).max(100).optional().describe("Discount %"),
        externalId: externalIdParam,
      },
      annotations: CREATE,
    },
    async (params) => {
      try {
        const result = await fm.post("/invoices", toBody(params));
        return insertStatusResult(created("Invoice", params.externalId), result, VERIFY);
      } catch (err) {
        return writeErrorResult(err, VERIFY);
      }
    },
  );

  server.registerTool(
    "finmap_invoice_delete",
    {
      description: "Delete an invoice by ID (careful!)",
      inputSchema: { id: z.string().describe("Invoice ID") },
      annotations: DELETE,
    },
    async ({ id }) => {
      const verify = `finmap_invoice_detail id=${id}`;
      try {
        const result = await fm.del(`/invoices/${encodeURIComponent(id)}`);
        return insertStatusResult(`Invoice ${id} deleted.`, result, verify);
      } catch (err) {
        return writeErrorResult(err, verify);
      }
    },
  );

  server.registerTool(
    "finmap_invoice_companies",
    { description: "List invoice companies (your company profiles)", annotations: READ },
    async () => {
      try {
        return textResult(listLabeled(asArray(await fm.get("/invoices/companies"), "invoice companies"), "Invoice Companies"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finmap_invoice_goods",
    { description: "List available goods/services for invoices", annotations: READ },
    async () => {
      try {
        return textResult(listLabeled(asArray(await fm.get("/invoices/goods"), "invoice goods"), "Goods/Services"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finmap_api_raw",
    {
      description:
        "Call any Finmap API v2.2 endpoint directly (advanced). POST/PATCH/DELETE change data and are never retried; " +
        "a body with status \"Error\" is returned as an error.",
      inputSchema: {
        method: z.enum(["GET", "POST", "PATCH", "DELETE"]).default("GET"),
        path: z.string().regex(/^\//, "path must start with /").describe("API path after /v2.2 (e.g. /accounts, /operations/list)"),
        body: z.string().optional().describe("JSON body for POST/PATCH"),
        query: z.record(z.string(), z.string()).optional().describe("Query parameters (any method)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ method, path, body, query }) => {
      const verify = "a GET of the affected resource";
      try {
        const parsed = body ? JSON.parse(body) : undefined;
        const result = await fm.request(method, path, method === "GET" || method === "DELETE" ? undefined : parsed, query);
        if ((result as { status?: unknown } | undefined)?.status === "Error") {
          return errorResult(new Error(`Finmap returned status "Error".\n${json(result)}`));
        }
        return textResult(`# ${method} ${path}\n${json(result)}`);
      } catch (err) {
        return writeErrorResult(err, verify);
      }
    },
  );
}
