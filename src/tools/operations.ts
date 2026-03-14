import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";
import { toTimestamp, textResult, errorResult } from "../utils.js";

interface OpListResult {
  list: Record<string, unknown>[];
  total: number;
}

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
  server.tool(
    "finmap_operations_list",
    "Search and filter operations (income/expense/transfer). Returns paginated list.",
    {
      types: z.array(z.enum(["income", "expense", "transfer"])).optional().describe("Filter by type(s)"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
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
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
          desc: params.desc,
          field: "date",
        };
        if (params.types?.length) body.types = params.types;
        if (params.startDate) body.startDate = toTimestamp(params.startDate);
        if (params.endDate) body.endDate = toTimestamp(params.endDate + "T23:59:59");
        if (params.search) body.search = params.search;
        if (params.accountIds?.length) body.accountIds = params.accountIds;
        if (params.categoryIds?.length) body.categoryIds = params.categoryIds;
        if (params.projectIds?.length) body.projectIds = params.projectIds;
        if (params.tagIds?.length) body.tagIds = params.tagIds;
        if (params.counterpartyIds?.length) body.counterpartyIds = params.counterpartyIds;

        const result = await fm.post<OpListResult>("/operations/list", body);
        if (!result.list?.length) return textResult("No operations found.");

        const lines = [`# Operations (${result.list.length} of ${result.total})`, ""];
        for (const op of result.list) lines.push(formatOp(op));
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_operation_detail",
    "Get operation details by ID or external ID",
    {
      id: z.string().optional().describe("Operation ID"),
      externalId: z.string().optional().describe("External ID"),
    },
    async ({ id, externalId }) => {
      try {
        if (!id && !externalId) return errorResult(new Error("Provide at least one of id or externalId."));
        const query: Record<string, string> = {};
        if (id) query.id = id;
        if (externalId) query.externalId = externalId;
        const result = await fm.get<OpListResult>("/operations/details", query);
        if (!result.list?.length) return textResult("Operation not found.");
        return textResult(`# Operation Detail\n\`\`\`json\n${JSON.stringify(result.list[0], null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_income_create",
    "Create an income operation",
    {
      amount: z.number().min(0).describe("Amount (must be positive)"),
      accountToId: z.string().describe("Target account ID (use finmap_accounts to find)"),
      categoryId: z.string().optional().describe("Income category ID"),
      comment: z.string().optional(),
      date: z.string().optional().describe("Date (YYYY-MM-DD, default: today)"),
      projectId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      counterpartyId: z.string().optional(),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          amount: params.amount,
          accountToId: params.accountToId,
        };
        if (params.categoryId) body.categoryId = params.categoryId;
        if (params.comment) body.comment = params.comment;
        if (params.date) body.date = toTimestamp(params.date);
        if (params.projectId) body.projectId = params.projectId;
        if (params.tagIds?.length) body.tagIds = params.tagIds;
        if (params.counterpartyId) body.counterpartyId = params.counterpartyId;

        const result = await fm.post("/operations/income", body);
        return textResult(`Income created.\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_expense_create",
    "Create an expense operation",
    {
      amount: z.number().min(0).describe("Amount (must be positive)"),
      accountFromId: z.string().describe("Source account ID"),
      categoryId: z.string().optional().describe("Expense category ID"),
      comment: z.string().optional(),
      date: z.string().optional().describe("Date (YYYY-MM-DD, default: today)"),
      projectId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      counterpartyId: z.string().optional(),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          amount: params.amount,
          accountFromId: params.accountFromId,
        };
        if (params.categoryId) body.categoryId = params.categoryId;
        if (params.comment) body.comment = params.comment;
        if (params.date) body.date = toTimestamp(params.date);
        if (params.projectId) body.projectId = params.projectId;
        if (params.tagIds?.length) body.tagIds = params.tagIds;
        if (params.counterpartyId) body.counterpartyId = params.counterpartyId;

        const result = await fm.post("/operations/expense", body);
        return textResult(`Expense created.\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_transfer_create",
    "Create a transfer between accounts",
    {
      amount: z.number().min(0).describe("Amount"),
      accountFromId: z.string().describe("Source account ID"),
      accountToId: z.string().describe("Destination account ID"),
      amountTo: z.number().optional().describe("Amount in destination currency (if different)"),
      comment: z.string().optional(),
      date: z.string().optional().describe("Date (YYYY-MM-DD, default: today)"),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          amount: params.amount,
          accountFromId: params.accountFromId,
          accountToId: params.accountToId,
        };
        if (params.amountTo != null) body.amountTo = params.amountTo;
        if (params.comment) body.comment = params.comment;
        if (params.date) body.date = toTimestamp(params.date);

        const result = await fm.post("/operations/transfer", body);
        return textResult(`Transfer created.\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_operation_delete",
    "Delete an operation by ID (careful!)",
    {
      type: z.enum(["income", "expense", "transfer"]).describe("Operation type"),
      id: z.string().describe("Operation ID"),
    },
    async ({ type, id }) => {
      try {
        await fm.del(`/operations/${type}/${id}`);
        return textResult(`Operation ${id} (${type}) deleted.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
