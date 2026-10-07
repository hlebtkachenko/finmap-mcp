# Changelog

## 2.0.0

### Breaking
- Node.js 22+ required.
- Dates must be `YYYY-MM-DD` and are read as UTC days (end date inclusive to 23:59:59.999 UTC).
- `finmap_invoices_list` shows CONFIRMED/UNCONFIRMED (the `confirmedInvoice` flag) instead of PAID/UNPAID.
- `finmap_api_raw` requires a path starting with `/`.

### Fixes
- Creates and deletes report Finmap's processing status: `Error` and unrecognised responses are errors, `Stored`/queued are pending.
- Writes are never retried; no response or 5xx returns an "outcome unknown" error with the tool to verify with.
- List tools return an error instead of an empty list when the response is not a list.
- IDs in URL paths are percent-encoded.
- `finmap_suppliers` is described as suppliers only.
- README tool count and API coverage corrected.

### Features
- `externalId` on income, expense, transfer and invoice create (retry-safe, 409 on duplicate).
- `finmap_counterparties` lists debitors, creditors, investors, owners, employees, suppliers or tax organisations.
- MCP annotations on every tool.
- `FINMAP_API_URL` base URL override.
- End-to-end tests and `npm run check:contract` against the Finmap OpenAPI spec; CI runs both.
- Upgraded to MCP SDK 1.32, zod 4, TypeScript 7.

## 1.0.0 (2026-03-14)

### Features
- Initial release with 22 tools covering Finmap API v2.2
- Account management with balances
- Income, expense, and transfer operations (CRUD)
- Invoice management with line items
- Reference data: categories, projects, tags, currencies, suppliers
- Raw API endpoint for advanced usage

### Security
- 30-second HTTP timeout on all requests
- Zod schema validation on all parameters
- Amount fields validated as non-negative
- Date parameters validated before timestamp conversion
- Error responses truncated to 500 characters
