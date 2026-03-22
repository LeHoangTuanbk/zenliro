import { spawn, type ChildProcess } from 'child_process';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { StreamLineBuffer } from './stream-parser.js';
import type { ParsedStreamEvent } from './stream-parser.js';

export type StreamCallback = (event: ParsedStreamEvent) => void;

function parseCodexLine(line: string): ParsedStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed);

    if (event.type === 'thread.started' && event.thread_id) {
      return { type: 'session_id', sessionId: event.thread_id };
    }

    if (event.type === 'item.completed' && event.item) {
      const item = event.item;
      if (item.type === 'agent_message' && item.text) {
        return { type: 'text', text: item.text };
      }
      if (item.type === 'tool_call') {
        return {
          type: 'tool_use',
          id: item.id ?? '',
          name: item.name ?? '',
          params: item.arguments ? JSON.parse(item.arguments) : {},
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
      env: { ...process.env },
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
      const text = data.toString().trim();
      if (text) console.error('[Codex stderr]', text);
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
