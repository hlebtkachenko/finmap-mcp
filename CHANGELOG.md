# Changelog

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
