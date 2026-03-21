import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';

export class ZenliroMcpServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: 'zenliro',
      version: '1.0.0',
      description: 'Zenliro photo editing MCP server — read/write photo adjustments in real-time',
    });

    registerAllTools(this.server);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[ZenliroMCP] Server started on stdio');
  }
}
