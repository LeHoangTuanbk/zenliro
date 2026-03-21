import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { isDev } from '../utils.js';

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const MCP_SERVER_NAME = 'zenliro';

function getMcpServerCommand(): { command: string; args: string[] } {
  if (isDev()) {
    return {
      command: 'node',
      args: [path.join(process.cwd(), 'dist-electron', 'mcp', 'zenliro-mcp-server.js')],
    };
  }

  // Production: the MCP server JS is in the app's resources
  const appPath = app.getAppPath();
  // In production, appPath is inside .asar, go one level up for unpacked files
  const serverPath = path.join(appPath, '..', 'dist-electron', 'mcp', 'zenliro-mcp-server.js');

  return {
    command: 'node',
    args: [serverPath],
  };
}

export function registerMcpGlobally(): void {
  try {
    let config: Record<string, unknown> = {};

    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf-8');
      config = JSON.parse(raw);
    }

    const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
    const { command, args } = getMcpServerCommand();

    mcpServers[MCP_SERVER_NAME] = {
      command,
      args,
      env: {},
      type: 'stdio',
    };

    config.mcpServers = mcpServers;

    fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Zenliro] Registered MCP server globally in ${CLAUDE_CONFIG_PATH}`);
  } catch (err) {
    console.error('[Zenliro] Failed to register MCP server globally:', err);
  }
}

export function unregisterMcpGlobally(): void {
  try {
    if (!fs.existsSync(CLAUDE_CONFIG_PATH)) return;

    const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    const mcpServers = config.mcpServers as Record<string, unknown> | undefined;

    if (mcpServers && MCP_SERVER_NAME in mcpServers) {
      delete mcpServers[MCP_SERVER_NAME];
      fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`[Zenliro] Unregistered MCP server from ${CLAUDE_CONFIG_PATH}`);
    }
  } catch (err) {
    console.error('[Zenliro] Failed to unregister MCP server:', err);
  }
}
