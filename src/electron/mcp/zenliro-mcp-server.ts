#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';

const server = new McpServer({
  name: 'zenliro',
  version: '1.0.0',
  description: 'Zenliro photo editing MCP server — read/write photo adjustments in real-time',
});

registerAllTools(server);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[ZenliroMCP] Server started on stdio');
}).catch((err) => {
  console.error('[ZenliroMCP] Failed to start:', err);
  process.exit(1);
});
