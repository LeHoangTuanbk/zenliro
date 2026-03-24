import { spawn, type ChildProcess } from 'child_process';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { StreamLineBuffer } from './stream-parser.js';
import type { ParsedStreamEvent } from './stream-parser.js';
import { getShellEnv } from './shell-env.js';

export type StreamCallback = (event: ParsedStreamEvent) => void;

function parseCodexLine(line: string): ParsedStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed);

    if (event.type === 'thread.started' && event.thread_id) {
      return { type: 'session_id', sessionId: event.thread_id };
    }

    // Extract tool name from any item shape
    const extractToolName = (item: Record<string, unknown>): string => {
      // Try all known fields for tool name
      for (const key of ['name', 'tool_name', 'server_label']) {
        if (typeof item[key] === 'string' && item[key]) return item[key] as string;
      }
      const fn = item.function as Record<string, unknown> | undefined;
      if (fn?.name) return fn.name as string;
      // For command execution
      if (typeof item.command === 'string') {
        const cmd = item.command as string;
        return cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd;
      }
      return String(item.type ?? 'tool');
    };

    const isToolItem = (type: string) =>
      ['mcp_tool_call', 'tool_call', 'function_call', 'command_execution'].includes(type);

    // Tool call started
    if (event.type === 'item.started' && event.item) {
      const item = event.item;
      if (isToolItem(item.type)) {
        return {
          type: 'tool_use',
          id: item.id ?? '',
          name: extractToolName(item),
          params: {},
        };
      }
    }

    // Item completed
    if (event.type === 'item.completed' && event.item) {
      const item = event.item;
      if (item.type === 'agent_message' && item.text) {
        return { type: 'text', text: item.text };
      }
      if (isToolItem(item.type)) {
        let params = {};
        try {
          params = item.arguments
            ? (typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments)
            : {};
        } catch { /* ignore */ }
        return {
          type: 'tool_use',
          id: item.id ?? '',
          name: extractToolName(item),
          params,
        };
      }
    }

    if (event.type === 'turn.completed') {
      return { type: 'done' };
    }

    if (event.type === 'turn.failed' || event.type === 'error') {
      return { type: 'error', error: event.error?.message ?? event.message ?? 'Codex error' };
    }

    return null;
  } catch {
    return null;
  }
}

export class CodexManager {
  private process: ChildProcess | null = null;
  private lineBuffer = new StreamLineBuffer();
  private onEvent: StreamCallback | null = null;
  private sessionId: string | null = null;

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  sendMessage(text: string, onEvent: StreamCallback, options?: { model?: string }): void {
    if (this.isRunning()) {
      this.process?.kill('SIGTERM');
      this.process = null;
    }

    this.onEvent = onEvent;
    this.lineBuffer = new StreamLineBuffer();

    const args = [
      'exec',
      '--json',
      '-s', 'read-only',
      '-c', `instructions="${SYSTEM_PROMPT.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
    ];

    if (options?.model && options.model !== 'codex-default') {
      args.push('-m', options.model);
    }

    if (this.sessionId) {
      args.push('resume', '--last');
    }

    args.push(text);

    this.process = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getShellEnv(),
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = this.lineBuffer.feed(data.toString());
      for (const line of lines) {
        const parsed = parseCodexLine(line);
        if (parsed) {
          if (parsed.type === 'session_id') this.sessionId = parsed.sessionId;
          this.onEvent?.(parsed);
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const txt = data.toString().trim();
      if (txt) console.error('[Codex stderr]', txt);
    });

    this.process.on('exit', (code) => {
      console.log('[Codex] exited with code', code);
      const remaining = this.lineBuffer.flush();
      for (const line of remaining) {
        const parsed = parseCodexLine(line);
        if (parsed) this.onEvent?.(parsed);
      }
      this.onEvent?.({ type: 'done' });
      this.process = null;
    });

    this.process.on('error', (err) => {
      console.error('[Codex] spawn error:', err.message);
      this.onEvent?.({ type: 'error', error: err.message });
      this.process = null;
    });
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) this.process.kill('SIGKILL');
      }, 3000);
    }
    this.process = null;
    this.onEvent = null;
  }

  reset(): void {
    this.stop();
    this.sessionId = null;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }
}
