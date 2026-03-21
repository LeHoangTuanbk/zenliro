import path from 'path';
import { app } from 'electron';

export const CLAUDE_CLI = 'claude';

export const CLI_TIMEOUT_MS = 120_000;

export const getMcpConfigPath = () =>
  path.join(app.getPath('userData'), 'mcp-config.json');
