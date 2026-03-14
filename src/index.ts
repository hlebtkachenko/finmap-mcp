import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FinmapClient } from "./finmap-client.js";
import { registerReferenceTools } from "./tools/reference.js";
import { registerOperationsTools } from "./tools/operations.js";
import { registerInvoicesTools } from "./tools/invoices.js";

const apiKey = process.env.FINMAP_API_KEY;
if (!apiKey) {
  process.stderr.write("Missing env var: FINMAP_API_KEY\n");
  process.exit(1);
}

const client = new FinmapClient(apiKey);

const server = new McpServer({
  name: "finmap",
  version: "1.0.0",
});

registerReferenceTools(server, client);
registerOperationsTools(server, client);
registerInvoicesTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
