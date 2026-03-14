import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FinmapClient } from "./finmap-client.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerOperationsTools } from "./tools/operations.js";
import { registerInvoicesTools } from "./tools/invoices.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

function env(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return val;
}

const client = new FinmapClient(env("FINMAP_API_KEY"));
const server = new McpServer({ name: "finmap", version: pkg.version });

registerReferenceTools(server, client);
registerOperationsTools(server, client);
registerInvoicesTools(server, client);

await server.connect(new StdioServerTransport());
