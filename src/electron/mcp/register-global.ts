import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { isDev } from '../utils.js';
import { createLogger } from '../logger/index.js';

const log = createLogger('main/mcp-register');

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const CODEX_CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
const MCP_SERVER_NAME = 'zenliro';

function getMcpServerCommand(): { command: string; args: string[] } {
  if (isDev()) {
    return {
      command: 'node',
      args: [path.join(process.cwd(), 'dist-electron', 'mcp', 'zenliro-mcp-server.js')],
    };
  }

  // In production, MCP server is bundled (all deps inlined) and unpacked from asar.
  // Bundle created by: esbuild → zenliro-mcp-server.bundle.mjs
  const appPath = app.getAppPath(); // e.g. .../Resources/app.asar
  const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
  const serverPath = path.join(unpackedPath, 'dist-electron', 'mcp', 'zenliro-mcp-server.bundle.mjs');

  return {
    command: 'node',
    args: [serverPath],
  };
}

function registerInClaude(command: string, args: string[]): void {
  try {
    let config: Record<string, unknown> = {};

    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf-8');
      config = JSON.parse(raw);
    }

    const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
    mcpServers[MCP_SERVER_NAME] = { command, args, env: {}, type: 'stdio' };
    config.mcpServers = mcpServers;

    fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    log.info(`Registered MCP in Claude: ${CLAUDE_CONFIG_PATH}`);
  } catch (err) {
    log.error('Failed to register MCP in Claude:', err);
  }
}

function registerInCodex(command: string, args: string[]): void {
  try {
    if (!fs.existsSync(CODEX_CONFIG_PATH)) return;

    let toml = fs.readFileSync(CODEX_CONFIG_PATH, 'utf-8');

    // Check if zenliro section already exists
    if (toml.includes(`[mcp_servers.${MCP_SERVER_NAME}]`)) {
      // Replace existing section
      const sectionRegex = new RegExp(
        `\\[mcp_servers\\.${MCP_SERVER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`,
      );
      const newSection = buildCodexMcpSection(command, args);
      toml = toml.replace(sectionRegex, newSection);
    } else {
      // Append new section
      toml = toml.trimEnd() + '\n\n' + buildCodexMcpSection(command, args) + '\n';
    }

    fs.writeFileSync(CODEX_CONFIG_PATH, toml, 'utf-8');
    log.info(`Registered MCP in Codex: ${CODEX_CONFIG_PATH}`);
  } catch (err) {
    log.error('Failed to register MCP in Codex:', err);
  }
}

function buildCodexMcpSection(command: string, args: string[]): string {
  const argsToml = args.map((a) => `"${a}"`).join(', ');
  return `[mcp_servers.${MCP_SERVER_NAME}]\ncommand = "${command}"\nargs = [ ${argsToml} ]`;
}

export function registerMcpGlobally(): void {
  const { command, args } = getMcpServerCommand();
  registerInClaude(command, args);
  registerInCodex(command, args);
}

export function unregisterMcpGlobally(): void {
  // Claude
  try {
    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);
      const mcpServers = config.mcpServers as Record<string, unknown> | undefined;
      if (mcpServers && MCP_SERVER_NAME in mcpServers) {
        delete mcpServers[MCP_SERVER_NAME];
        fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      }
    }
  } catch { /* ignore */ }

  // Codex — remove section from TOML
  try {
    if (fs.existsSync(CODEX_CONFIG_PATH)) {
      let toml = fs.readFileSync(CODEX_CONFIG_PATH, 'utf-8');
      const sectionRegex = new RegExp(
        `\\n*\\[mcp_servers\\.${MCP_SERVER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`,
      );
      toml = toml.replace(sectionRegex, '');
      fs.writeFileSync(CODEX_CONFIG_PATH, toml, 'utf-8');
    }
  } catch { /* ignore */ }
}
