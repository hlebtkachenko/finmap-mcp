# AGENTS.md

Community MCP server for the Finmap API v2.2. TypeScript, Node 22+, stdio transport. Layout and design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

```bash
npm ci
npm run build           # tsc -> dist/
npm test                # build + node:test suite (fake Finmap API, no credentials)
npm run check:contract  # validate every tool's request against the Finmap OpenAPI spec
```

## Rules

- Any change to a request a tool sends must pass `npm run check:contract`. Look up field names in the spec (`.spec-cache/` after the first run), not in memory.
- New tools: register with `server.registerTool` and MCP annotations, add a row to the request table in `test/server.test.mjs` and to the README tools table (the README test checks the count).
- Writes go through `insertStatusResult` / `writeErrorResult` in `src/utils.ts`; never retry a POST.
- No live API calls in tests or scripts. Synthetic data only; never commit credentials (configuration is env-only).
