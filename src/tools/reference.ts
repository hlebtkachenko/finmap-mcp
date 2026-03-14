import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";
import { textResult, errorResult } from "../utils.js";

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
      try {
        const accounts = await fm.get<Account[]>("/accounts", { withBalances: "true" });
        if (!accounts?.length) return textResult("No accounts found.");

        const lines = [`# Accounts (${accounts.length})`, ""];
        for (const a of accounts) {
          const bal = a.balance != null ? ` | Balance: ${a.balance} ${a.currencyId}` : "";
          const comp = a.companyCurrencyBalance != null ? ` (${a.companyCurrencyBalance} company)` : "";
          lines.push(`- **${a.label}** (${a.id})${bal}${comp}`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool("finmap_categories_income", "List all income categories", {}, async () => {
    try {
      const cats = await fm.get<LabeledItem[]>("/categories/income");
      return textResult(listItems(cats, "Income Categories"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool("finmap_categories_expense", "List all expense categories", {}, async () => {
    try {
      const cats = await fm.get<LabeledItem[]>("/categories/expense");
      return textResult(listItems(cats, "Expense Categories"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool("finmap_projects", "List all Finmap projects", {}, async () => {
    try {
      const items = await fm.get<LabeledItem[]>("/projects");
      return textResult(listItems(items, "Projects"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool("finmap_tags", "List all Finmap tags", {}, async () => {
    try {
      const items = await fm.get<LabeledItem[]>("/tags");
      return textResult(listItems(items, "Tags"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool("finmap_currencies", "List all supported currencies", {}, async () => {
    try {
      const items = await fm.get<Currency[]>("/currencies");
      if (!items?.length) return textResult("No currencies.");
      const lines = [`# Currencies (${items.length})`, ""];
      for (const c of items) lines.push(`- ${c.symbol} (${c.id})`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool("finmap_suppliers", "List all suppliers/counterparties", {}, async () => {
    try {
      const items = await fm.get<LabeledItem[]>("/suppliers");
      return textResult(listItems(items, "Suppliers"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool(
    "finmap_project_create",
    "Create a new project",
    { label: z.string().describe("Project name") },
    async ({ label }) => {
      try {
        const result = await fm.post<LabeledItem>("/projects", { label });
        return textResult(`Project created: ${result.label} (${result.id})`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "finmap_tag_create",
    "Create a new tag",
    { label: z.string().describe("Tag name") },
    async ({ label }) => {
      try {
        const result = await fm.post<LabeledItem>("/tags", { label });
        return textResult(`Tag created: ${result.label} (${result.id})`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
