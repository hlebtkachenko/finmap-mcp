# Architecture

## Structure

```
src/
  index.ts              Entry point: env config, tool registration
  finmap-client.ts      HTTP client (apiKey header, 30 s timeout, no retries, FinmapError)
  utils.ts              Dates, annotations, request bodies, list guards, write status handling
  tools/
    reference.ts        Accounts, categories, projects, tags, currencies, counterparties
    operations.ts       Operations list/detail, income/expense/transfer create, delete
    invoices.ts         Invoices list/detail/create/delete, companies, goods, raw API
test/                   node:test suite, runs dist/ against the fake API
scripts/
  fake-finmap.mjs       Fake Finmap API that records requests (tests and contract check)
  check-contract.mjs    Validates every tool's request against the OpenAPI spec
```

## Flow

```
MCP client --stdio--> tool handler --> FinmapClient --HTTPS--> api.finmap.online/v2.2
                           ^                                      |
                           +---- utils (status/list guards) <-----+
```

## Design notes

- **Spec is the contract.** `npm run check:contract` downloads https://api.finmap.online/json, calls every tool twice (all fields, required only) and validates path, query and body with ajv. Objects are closed (`additionalProperties: false`) so a misspelled field fails. The spec types `InvoiceOperationDto.goods` items as strings although its own example sends objects; the check overrides that one schema.
- **Write status.** Operation and invoice create/delete return `OperationInsertStatus`. `Processed now` is success, `Stored` / `In the queue for processing` are pending, `Error` or anything else is isError.
- **No retries.** Transport failures, timeouts, 5xx and non-JSON bodies on writes are "outcome unknown" errors that name the read tool to verify with. `externalId` on creates makes a manual retry safe (409 on duplicate).
- **Lists** must be arrays (`asArray` / `asList`); an error payload never reads as an empty list.
- **Dates** are `YYYY-MM-DD` UTC days: start at 00:00:00.000Z, end date inclusive to 23:59:59.999Z.
