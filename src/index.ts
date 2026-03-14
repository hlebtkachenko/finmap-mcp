import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FinmapClient } from "./finmap-client.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerOperationsTools } from "./tools/operations.js";
import { registerInvoicesTools } from "./tools/invoices.js";

function env(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return val;
}

const client = new FinmapClient(env("FINMAP_API_KEY"));
const server = new McpServer({ name: "finmap", version: "1.0.0" });

registerReferenceTools(server, client);
registerOperationsTools(server, client);
registerInvoicesTools(server, client);

await server.connect(new StdioServerTransport());
