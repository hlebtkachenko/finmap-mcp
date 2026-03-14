import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";

interface Account {
  id: string;
  label: string;
  currencyId: string;
  balance?: number;
  companyCurrencyBalance?: number;
}

interface LabeledItem {
  id: string;
  label: string;
  isSystem?: boolean;
}

interface Currency {
  id: string;
  symbol: string;
}

function listItems(items: LabeledItem[], title: string): string {
  if (!items?.length) return `No ${title.toLowerCase()} found.`;
  const lines = [`# ${title} (${items.length})`, ""];
  for (const i of items) {
    const badge = i.isSystem ? " [system]" : "";
    lines.push(`- ${i.label} (${i.id})${badge}`);
  }
  return lines.join("\n");
}

export function registerReferenceTools(server: McpServer, fm: FinmapClient) {
  server.tool(
    "finmap_accounts",
    "List all Finmap accounts with balances (bank accounts, cash, cards, etc.)",
    {},
    async () => {
      const accounts = await fm.get<Account[]>("/accounts", { withBalances: "true" });
      if (!accounts?.length) return { content: [{ type: "text", text: "No accounts found." }] };

      const lines = [`# Accounts (${accounts.length})`, ""];
      for (const a of accounts) {
        const bal = a.balance != null ? ` | Balance: ${a.balance} ${a.currencyId}` : "";
        const comp = a.companyCurrencyBalance != null ? ` (${a.companyCurrencyBalance} company)` : "";
        lines.push(`- **${a.label}** (${a.id})${bal}${comp}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool("finmap_categories_income", "List all income categories", {}, async () => {
    const cats = await fm.get<LabeledItem[]>("/categories/income");
    return { content: [{ type: "text", text: listItems(cats, "Income Categories") }] };
  });

  server.tool("finmap_categories_expense", "List all expense categories", {}, async () => {
    const cats = await fm.get<LabeledItem[]>("/categories/expense");
    return { content: [{ type: "text", text: listItems(cats, "Expense Categories") }] };
  });

  server.tool("finmap_projects", "List all Finmap projects", {}, async () => {
    const items = await fm.get<LabeledItem[]>("/projects");
    return { content: [{ type: "text", text: listItems(items, "Projects") }] };
  });

  server.tool("finmap_tags", "List all Finmap tags", {}, async () => {
    const items = await fm.get<LabeledItem[]>("/tags");
    return { content: [{ type: "text", text: listItems(items, "Tags") }] };
  });

  server.tool("finmap_currencies", "List all supported currencies", {}, async () => {
    const items = await fm.get<Currency[]>("/currencies");
    if (!items?.length) return { content: [{ type: "text", text: "No currencies." }] };
    const lines = [`# Currencies (${items.length})`, ""];
    for (const c of items) lines.push(`- ${c.symbol} (${c.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool("finmap_suppliers", "List all suppliers/counterparties", {}, async () => {
    const items = await fm.get<LabeledItem[]>("/suppliers");
    return { content: [{ type: "text", text: listItems(items, "Suppliers") }] };
  });

  server.tool(
    "finmap_project_create",
    "Create a new project",
    { label: z.string().describe("Project name") },
    async ({ label }) => {
      const result = await fm.post<LabeledItem>("/projects", { label });
      return { content: [{ type: "text", text: `Project created: ${result.label} (${result.id})` }] };
    },
  );

  server.tool(
    "finmap_tag_create",
    "Create a new tag",
    { label: z.string().describe("Tag name") },
    async ({ label }) => {
      const result = await fm.post<LabeledItem>("/tags", { label });
      return { content: [{ type: "text", text: `Tag created: ${result.label} (${result.id})` }] };
    },
  );
}
