# Community Finmap MCP Server

**Not affiliated with Finmap**. Official MCP at https://api.finmap.online/mcp

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue)

MCP server for [Finmap](https://finmap.online), a financial management platform. Work with accounts, operations, invoices, and reference data from any MCP-compatible client.

23 tools. They wrap 29 of the 98 operations in the Finmap API v2.2 spec (reads, operation and invoice create/delete, project and tag create); `finmap_api_raw` reaches the rest.

## Requirements

- Node.js 22+
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
| `FINMAP_API_URL` | No | API base URL (default `https://api.finmap.online/v2.2`; tests point it at a fake server) |

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
| `finmap_suppliers` | Suppliers (one counterparty type) |
| `finmap_counterparties` | Counterparties of one type: debitors (customers), creditors, investors, owners, employees, suppliers, tax organisations |
| `finmap_project_create` | Create a project |
| `finmap_tag_create` | Create a tag |

### Operations

| Tool | Description |
|------|-------------|
| `finmap_operations_list` | Search and filter by type, date (whole UTC days), account, category, project, tag, or counterparty |
| `finmap_operation_detail` | Get operation by ID or external ID |
| `finmap_income_create` | Create income operation (optional `externalId`) |
| `finmap_expense_create` | Create expense operation (optional `externalId`) |
| `finmap_transfer_create` | Create transfer between accounts (optional `externalId`) |
| `finmap_operation_delete` | Delete an operation |

### Invoices

| Tool | Description |
|------|-------------|
| `finmap_invoices_list` | List and filter by date, payment state (`invoiceStatus`), or confirmation; lines show CONFIRMED/UNCONFIRMED |
| `finmap_invoice_detail` | Invoice details by ID |
| `finmap_invoice_create` | Create invoice with goods, company, and client details (optional `externalId`) |
| `finmap_invoice_delete` | Delete an invoice |
| `finmap_invoice_companies` | List your company profiles |
| `finmap_invoice_goods` | Available goods and services |

### Raw API

| Tool | Description |
|------|-------------|
| `finmap_api_raw` | Call any Finmap API v2.2 endpoint directly (GET, POST, PATCH, DELETE) |

## Writes and retries

- Creates and deletes return Finmap's processing status. `Processed now` is success, `Stored` and `In the queue for processing` are reported as accepted but pending, `Error` and any unrecognised response are returned as errors.
- Requests are never retried. A write that times out or gets no answer returns an "outcome unknown" error naming the read tool to check with.
- Pass `externalId` on creates: on a retry with the same value Finmap answers 409 and nothing is created twice.
- Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`); deletes and `finmap_api_raw` are marked destructive.

## Security

- 30-second timeout on all HTTP requests
- IDs in URL paths are percent-encoded
- Amount fields validated as non-negative numbers
- Dates must be `YYYY-MM-DD` and are read as UTC days
- Error responses truncated to 500 characters
- All parameters validated with Zod schemas

## Development

```bash
npm ci
npm test                # build + end-to-end tests against a fake Finmap API (no credentials)
npm run check:contract  # validate every tool's request against the Finmap OpenAPI spec
```

Layout and design: [ARCHITECTURE.md](ARCHITECTURE.md). Contributor rules: [AGENTS.md](AGENTS.md).

## Tech Stack

- TypeScript
- `@modelcontextprotocol/sdk`
- Zod (schema validation)
- Native `fetch`

## API Reference

[Finmap API v2.2](https://api.finmap.online/)

## License

[MIT](LICENSE)
