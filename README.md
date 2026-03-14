# Finmap MCP Server

MCP server for [Finmap](https://finmap.online), a financial management platform. Work with accounts, operations, invoices, and reference data from any MCP-compatible client.

22 tools covering the full Finmap API v2.2.

## Requirements

- Node.js 20+
- Finmap API key (Settings → API in your Finmap account)

## Installation

```bash
git clone https://github.com/hlebtkachenko/finmap-mcp.git
cd finmap-mcp
npm ci
npm run build
```

## Configuration

### Cursor

`~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "finmap": {
      "command": "node",
      "args": ["/path/to/finmap-mcp/dist/index.js"],
      "env": {
        "FINMAP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json` ([location](https://modelcontextprotocol.io/quickstart/user#1-open-your-mcp-client))

```json
{
  "mcpServers": {
    "finmap": {
      "command": "node",
      "args": ["/path/to/finmap-mcp/dist/index.js"],
      "env": {
        "FINMAP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

`.mcp.json` in your project root, or `~/.claude.json` globally:

```json
{
  "mcpServers": {
    "finmap": {
      "command": "node",
      "args": ["/path/to/finmap-mcp/dist/index.js"],
      "env": {
        "FINMAP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Any MCP client (stdio)

The server uses `stdio` transport. Point your MCP client to:

```
node /path/to/finmap-mcp/dist/index.js
```

With the `FINMAP_API_KEY` environment variable set.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINMAP_API_KEY` | Yes | API key from Finmap account settings |

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
| `finmap_suppliers` | Suppliers and counterparties |
| `finmap_project_create` | Create a project |
| `finmap_tag_create` | Create a tag |

### Operations

| Tool | Description |
|------|-------------|
| `finmap_operations_list` | Search and filter by type, date, account, category, project, or tag |
| `finmap_operation_detail` | Get operation by ID or external ID |
| `finmap_income_create` | Create income operation |
| `finmap_expense_create` | Create expense operation |
| `finmap_transfer_create` | Create transfer between accounts |
| `finmap_operation_delete` | Delete an operation |

### Invoices

| Tool | Description |
|------|-------------|
| `finmap_invoices_list` | List and filter by date, status, or confirmation |
| `finmap_invoice_detail` | Invoice details by ID |
| `finmap_invoice_create` | Create invoice with goods, company, and client details |
| `finmap_invoice_delete` | Delete an invoice |
| `finmap_invoice_companies` | List your company profiles |
| `finmap_invoice_goods` | Available goods and services |

### Raw API

| Tool | Description |
|------|-------------|
| `finmap_api_raw` | Call any Finmap API v2.2 endpoint directly |

## Security

- 30-second timeout on all HTTP requests
- JSON body parsing wrapped in try/catch
- Amount fields validated as non-negative numbers
- Date parameters validated before conversion to timestamps
- Error responses truncated to 500 characters
- All parameters validated with Zod schemas

## Architecture

```
src/
  index.ts              Entry point, env validation
  finmap-client.ts      API client (apiKey header auth)
  tools/
    reference.ts        Accounts and reference data (9 tools)
    operations.ts       Financial operations (6 tools)
    invoices.ts         Invoice management (7 tools)
```

## Tech Stack

- TypeScript
- `@modelcontextprotocol/sdk`
- Zod (schema validation)
- Native `fetch`

## API Reference

[Finmap API v2.2](https://api.finmap.online/)

## License

[MIT](LICENSE)
