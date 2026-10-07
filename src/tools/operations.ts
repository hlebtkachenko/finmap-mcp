import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";
import {
  toBody, listBody, detailResult, textResult, errorResult, asList, insertStatusResult, writeErrorResult,
  READ, CREATE, DELETE, externalIdParam, created,
} from "../utils.js";

const VERIFY = "finmap_operation_detail (externalId) or finmap_operations_list";
const dateParam = z.string().optional().describe("Date (YYYY-MM-DD, stored as 00:00 UTC; default: today)");

function formatOp(op: Record<string, unknown>): string {
  const type = String(op.type || "unknown").toUpperCase();
  const amount = op.sum ?? op.amount ?? "?";
  const curr = op.currencySymbol || op.currencyId || "";
  const date = op.date ? new Date(op.date as number).toISOString().split("T")[0] : "?";
  const comment = op.comment ? ` — ${op.comment}` : "";
  const cat = op.categoryName ? ` [${op.categoryName}]` : "";
  const acc = op.accountName || op.accountFromName || op.accountToName || "";
  const party = op.counterpartyName ? ` (${op.counterpartyName})` : "";
  return `- **${type}** ${date}: ${amount} ${curr}${cat}${party} | ${acc}${comment} (id: ${op.id})`;
}

export function registerOperationsTools(server: McpServer, fm: FinmapClient) {
  server.registerTool(
    "finmap_operations_list",
    {
      description: "Search and filter operations (income/expense/transfer). Returns paginated list. Dates are whole UTC days.",
      inputSchema: {
        types: z.array(z.enum(["income", "expense", "transfer"])).optional().describe("Filter by type(s)"),
        startDate: z.string().optional().describe("Start date (YYYY-MM-DD, from 00:00 UTC)"),
        endDate: z.string().optional().describe("End date (YYYY-MM-DD, inclusive, to 23:59:59.999 UTC)"),
        search: z.string().optional().describe("Search by comment text"),
        accountIds: z.array(z.string()).optional().describe("Filter by account IDs"),
        categoryIds: z.array(z.string()).optional().describe("Filter by category IDs"),
        projectIds: z.array(z.string()).optional().describe("Filter by project IDs"),
        tagIds: z.array(z.string()).optional().describe("Filter by tag IDs"),
        counterpartyIds: z.array(z.string()).optional().describe("Filter by counterparty IDs"),
        limit: z.number().optional().default(25),
        offset: z.number().optional().default(0),
        desc: z.boolean().optional().default(true).describe("Sort descending by date"),
      },
      annotations: READ,
    },
    async (params) => {
      try {
        const result = asList<Record<string, unknown>>(await fm.post("/operations/list", listBody(params)), "operations list");
        if (!result.list.length) return textResult("No operations found.");

        const lines = [`# Operations (${result.list.length} of ${result.total})`, ""];
        for (const op of result.list) lines.push(formatOp(op));
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finmap_operation_detail",
    {
      description: "Get operation details by ID or external ID",
      inputSchema: {
        id: z.string().optional().describe("Operation ID"),
        externalId: z.string().optional().describe("External ID"),
      },
      annotations: READ,
    },
    ({ id, externalId }) => detailResult(fm, "/operations/details", "Operation", id, externalId),
  );

  // Income and expense share one shape; they differ in the account field and counterparty kinds.
  const variants = [
    {
      type: "income", label: "Income", account: "accountToId",
      accountDesc: "Target account ID (use finmap_accounts to find)",
      categoryDesc: "Income category ID",
      counterpartyDesc: "Customer (debitor), creditor or investor ID (use finmap_counterparties)",
    },
    {
      type: "expense", label: "Expense", account: "accountFromId",
      accountDesc: "Source account ID (use finmap_accounts to find)",
      categoryDesc: "Expense category ID",
      counterpartyDesc: "Supplier, employee, owner, tax organisation, creditor or debitor ID (use finmap_counterparties)",
    },
  ] as const;

  for (const v of variants) {
    server.registerTool(
      `finmap_${v.type}_create`,
      {
        description: `Create an ${v.type} operation. Pass externalId so a retry cannot create a duplicate.`,
        inputSchema: {
          amount: z.number().min(0).describe("Amount (must be positive)"),
          [v.account]: z.string().describe(v.accountDesc),
          categoryId: z.string().optional().describe(v.categoryDesc),
          comment: z.string().optional(),
          date: dateParam,
          projectId: z.string().optional(),
          tagIds: z.array(z.string()).optional(),
          counterpartyId: z.string().optional().describe(v.counterpartyDesc),
          externalId: externalIdParam,
        },
        annotations: CREATE,
      },
      async (params) => {
        try {
          const result = await fm.post(`/operations/${v.type}`, toBody(params));
          return insertStatusResult(created(v.label, params.externalId as string | undefined), result, VERIFY);
        } catch (err) {
          return writeErrorResult(err, VERIFY);
        }
      },
    );
  }

  server.registerTool(
    "finmap_transfer_create",
    {
      description: "Create a transfer between accounts. Pass externalId so a retry cannot create a duplicate.",
      inputSchema: {
        amount: z.number().min(0).describe("Amount"),
        accountFromId: z.string().describe("Source account ID"),
        accountToId: z.string().describe("Destination account ID"),
        amountTo: z.number().min(0).optional().describe("Amount in destination currency (if different)"),
        comment: z.string().optional(),
        date: dateParam,
        externalId: externalIdParam,
      },
      annotations: CREATE,
    },
    async (params) => {
      try {
        const result = await fm.post("/operations/transfer", toBody(params));
        return insertStatusResult(created("Transfer", params.externalId), result, VERIFY);
      } catch (err) {
        return writeErrorResult(err, VERIFY);
      }
    },
  );

  server.registerTool(
    "finmap_operation_delete",
    {
      description: "Delete an operation by ID (careful!)",
      inputSchema: {
        type: z.enum(["income", "expense", "transfer"]).describe("Operation type"),
        id: z.string().describe("Operation ID"),
      },
      annotations: DELETE,
    },
    async ({ type, id }) => {
      const verify = `finmap_operation_detail id=${id}`;
      try {
        const result = await fm.del(`/operations/${type}/${encodeURIComponent(id)}`);
        return insertStatusResult(`Operation ${id} (${type}) deleted.`, result, verify);
      } catch (err) {
        return writeErrorResult(err, verify);
      }
    },
  );
}
