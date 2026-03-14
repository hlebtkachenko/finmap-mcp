import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";

function fmt(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

interface Account {
  id: string;
  label: string;
  parentId: string;
  currencyId: string;
  balance?: number;
  companyCurrencyBalance?: number;
}

interface LabeledItem {
  id: string;
  label: string;
  parentId?: string;
  isSystem?: boolean;
}

interface Currency {
  id: string;
  symbol: string;
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
        const compBal = a.companyCurrencyBalance != null ? ` (${a.companyCurrencyBalance} company currency)` : "";
        lines.push(`- **${a.label}** (${a.id})${bal}${compBal}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool("finmap_categories_income", "List all income categories", {}, async () => {
    const cats = await fm.get<LabeledItem[]>("/categories/income");
    if (!cats?.length) return { content: [{ type: "text", text: "No income categories." }] };
    const lines = [`# Income Categories (${cats.length})`, ""];
    for (const c of cats) {
      lines.push(`- ${c.label} (${c.id})${c.isSystem ? " [system]" : ""}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool("finmap_categories_expense", "List all expense categories", {}, async () => {
    const cats = await fm.get<LabeledItem[]>("/categories/expense");
    if (!cats?.length) return { content: [{ type: "text", text: "No expense categories." }] };
    const lines = [`# Expense Categories (${cats.length})`, ""];
    for (const c of cats) {
      lines.push(`- ${c.label} (${c.id})${c.isSystem ? " [system]" : ""}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool("finmap_projects", "List all Finmap projects", {}, async () => {
    const items = await fm.get<LabeledItem[]>("/projects");
    if (!items?.length) return { content: [{ type: "text", text: "No projects." }] };
    const lines = [`# Projects (${items.length})`, ""];
    for (const p of items) lines.push(`- ${p.label} (${p.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  server.tool("finmap_tags", "List all Finmap tags", {}, async () => {
    const items = await fm.get<LabeledItem[]>("/tags");
    if (!items?.length) return { content: [{ type: "text", text: "No tags." }] };
    const lines = [`# Tags (${items.length})`, ""];
    for (const t of items) lines.push(`- ${t.label} (${t.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
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
    if (!items?.length) return { content: [{ type: "text", text: "No suppliers." }] };
    const lines = [`# Suppliers (${items.length})`, ""];
    for (const s of items) lines.push(`- ${s.label} (${s.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
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
