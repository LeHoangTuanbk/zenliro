import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

let cachedEnv: NodeJS.ProcessEnv | null = null;

/**
 * Get environment variables with full shell PATH.
 * In production Electron builds, process.env.PATH is minimal (/usr/bin:/bin).
 * This resolves the user's actual shell PATH so spawned CLIs (claude, codex) are found.
 */
export function getShellEnv(): NodeJS.ProcessEnv {
  if (cachedEnv) return cachedEnv;

  const env = { ...process.env };
  const extraPaths = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.npm-global', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
  ];

  // Try to get the real shell PATH
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const shell = env.SHELL || '/bin/zsh';
      const shellPath = execSync(`${shell} -ilc 'echo $PATH'`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      if (shellPath) {
        env.PATH = shellPath;
        cachedEnv = env;
        return env;
      }
    } catch {
      // Fallback to manual PATH extension
    }
  }

  // Fallback: append common paths
  const currentPath = env.PATH ?? '';
  const missing = extraPaths.filter((p) => !currentPath.includes(p));
  if (missing.length > 0) {
    env.PATH = [currentPath, ...missing].filter(Boolean).join(':');
  }

  cachedEnv = env;
  return env;
}
