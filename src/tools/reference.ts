import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FinmapClient } from "../finmap-client.js";
import { textResult, errorResult, asArray, writeErrorResult, READ, CREATE } from "../utils.js";

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

// Counterparty endpoints. Income counterpartyId takes debitors (customers), creditors and investors;
// expense counterpartyId takes debitors, creditors, employees, suppliers, owners and tax organisations.
const COUNTERPARTY_TYPES = ["debitors", "creditors", "investors", "owners", "employees", "suppliers", "tax-organisations"] as const;

function listItems(items: LabeledItem[], title: string): string {
  if (!items.length) return `No ${title.toLowerCase()} found.`;
  const lines = [`# ${title} (${items.length})`, ""];
  for (const i of items) {
    const badge = i.isSystem ? " [system]" : "";
    lines.push(`- ${i.label} (${i.id})${badge}`);
  }
  return lines.join("\n");
}

export function registerReferenceTools(server: McpServer, fm: FinmapClient) {
  server.registerTool(
    "finmap_accounts",
    { description: "List all Finmap accounts with balances (bank accounts, cash, cards, etc.)", annotations: READ },
    async () => {
      try {
        const accounts = asArray<Account>(await fm.get("/accounts", { withBalances: "true" }), "accounts");
        if (!accounts.length) return textResult("No accounts found.");

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

  const simpleLists = [
    ["finmap_categories_income", "List all income categories", "/categories/income", "Income Categories"],
    ["finmap_categories_expense", "List all expense categories", "/categories/expense", "Expense Categories"],
    ["finmap_projects", "List all Finmap projects", "/projects", "Projects"],
    ["finmap_tags", "List all Finmap tags", "/tags", "Tags"],
    ["finmap_suppliers", "List suppliers (one counterparty type; for the others use finmap_counterparties)", "/suppliers", "Suppliers"],
  ] as const;
  for (const [name, description, path, title] of simpleLists) {
    server.registerTool(name, { description, annotations: READ }, async () => {
      try {
        return textResult(listItems(asArray(await fm.get(path), title), title));
      } catch (err) {
        return errorResult(err);
      }
    });
  }

  server.registerTool(
    "finmap_counterparties",
    {
      description:
        "List counterparties of one type. Use the IDs as counterpartyId: income takes debitors (customers), creditors, investors; " +
        "expense takes debitors, creditors, employees, suppliers, owners, tax-organisations.",
      inputSchema: { type: z.enum(COUNTERPARTY_TYPES).describe("Counterparty type") },
      annotations: READ,
    },
    async ({ type }) => {
      try {
        return textResult(listItems(asArray(await fm.get(`/${type}`), type), `Counterparties: ${type}`));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool("finmap_currencies", { description: "List all supported currencies", annotations: READ }, async () => {
    try {
      const items = asArray<Currency>(await fm.get("/currencies"), "currencies");
      if (!items.length) return textResult("No currencies.");
      const lines = [`# Currencies (${items.length})`, ""];
      for (const c of items) lines.push(`- ${c.symbol} (${c.id})`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  });

  for (const [name, path, what] of [["finmap_project_create", "/projects", "Project"], ["finmap_tag_create", "/tags", "Tag"]] as const) {
    server.registerTool(
      name,
      {
        description: `Create a new ${what.toLowerCase()}`,
        inputSchema: { label: z.string().describe(`${what} name`) },
        annotations: CREATE,
      },
      async ({ label }) => {
        const verify = `finmap_${what.toLowerCase()}s`;
        try {
          const result = await fm.post<LabeledItem | undefined>(path, { label });
          if (!result?.id) return errorResult(new Error(`Unexpected Finmap response, outcome unknown. Verify with ${verify} before retrying.`));
          return textResult(`${what} created: ${result.label} (${result.id})`);
        } catch (err) {
          return writeErrorResult(err, verify);
        }
      },
    );
  }
}
