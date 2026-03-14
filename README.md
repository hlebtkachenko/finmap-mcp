# Finmap MCP Server

MCP (Model Context Protocol) server for [Finmap](https://finmap.online) — financial management platform. Manage accounts, operations, invoices, and reference data directly from AI assistants like Cursor and Claude.

## Features

- **Accounts** — list all accounts with balances (bank, cash, cards)
- **Operations** — search/filter income, expenses, transfers; create and delete
- **Invoices** — list, create, delete invoices; manage companies and goods
- **Reference Data** — categories, projects, tags, currencies, suppliers
- **Raw API Access** — call any Finmap API v2.2 endpoint directly

22 tools total covering the full Finmap API v2.2.

## Requirements

- Node.js 20+
- Finmap API key (Settings → API in your Finmap account)

## Setup

```bash
npm install
npm run build
```

## Configuration

Add to your MCP config (`~/.cursor/mcp.json` or Claude `settings.json`):

```json
{
  "mcpServers": {
    "finmap": {
      "command": "node",
      "args": ["path/to/finmap-mcp/dist/index.js"],
      "env": {
        "FINMAP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINMAP_API_KEY` | Yes | API key from Finmap settings |

## Tools

### Accounts & Reference Data

| Tool | Description |
|------|-------------|
| `finmap_accounts` | List all accounts with balances |
| `finmap_categories_income` | Income categories |
| `finmap_categories_expense` | Expense categories |
| `finmap_projects` | List projects |
| `finmap_tags` | List tags |
| `finmap_currencies` | Supported currencies |
| `finmap_suppliers` | Suppliers / counterparties |
| `finmap_project_create` | Create a project |
| `finmap_tag_create` | Create a tag |

### Operations

| Tool | Description |
|------|-------------|
| `finmap_operations_list` | Search/filter operations (by type, date, account, category, project, tag) |
| `finmap_operation_detail` | Get operation by ID or external ID |
| `finmap_income_create` | Create income operation |
| `finmap_expense_create` | Create expense operation |
| `finmap_transfer_create` | Create transfer between accounts |
| `finmap_operation_delete` | Delete operation |

### Invoices

| Tool | Description |
|------|-------------|
| `finmap_invoices_list` | List/filter invoices (by date, status, confirmation) |
| `finmap_invoice_detail` | Invoice details by ID |
| `finmap_invoice_create` | Create invoice |
| `finmap_invoice_delete` | Delete invoice |
| `finmap_invoice_companies` | List your company profiles |
| `finmap_invoice_goods` | Available goods/services |

### Advanced

| Tool | Description |
|------|-------------|
| `finmap_api_raw` | Call any Finmap API endpoint directly |

## API Reference

Full Finmap API v2.2 documentation: [api.finmap.online](https://api.finmap.online/)

## Tech Stack

- TypeScript, MCP SDK (`@modelcontextprotocol/sdk`)
- Zod schema validation
- Native `fetch` (no external HTTP dependencies)

## License

MIT
