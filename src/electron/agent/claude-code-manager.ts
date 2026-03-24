import { spawn, type ChildProcess } from 'child_process';
import { CLAUDE_CLI } from './const.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { StreamLineBuffer, parseStreamLine, type ParsedStreamEvent } from './stream-parser.js';
import { getShellEnv } from './shell-env.js';

export type StreamCallback = (event: ParsedStreamEvent) => void;

export class ClaudeCodeManager {
  private process: ChildProcess | null = null;
  private lineBuffer = new StreamLineBuffer();
  private onEvent: StreamCallback | null = null;
  private sessionId: string | null = null;

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  sendMessage(text: string, onEvent: StreamCallback, options?: { model?: string }): void {
    // Kill any running process
    if (this.isRunning()) {
      this.process?.kill('SIGTERM');
      this.process = null;
    }

    this.onEvent = onEvent;
    this.lineBuffer = new StreamLineBuffer();

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--system-prompt', SYSTEM_PROMPT,
      '--allowedTools', 'mcp__zenliro__*',
      '--dangerously-skip-permissions',
    ];

    if (options?.model) {
      args.push('--model', options.model);
    }

    // Resume previous session for multi-turn context
    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    // Prompt as argument
    args.push(text);

    this.process = spawn(CLAUDE_CLI, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getShellEnv(),
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = this.lineBuffer.feed(data.toString());
      for (const line of lines) {
        const parsed = parseStreamLine(line);
        if (parsed) {
          this.onEvent?.(parsed);
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.trim()) {
        console.error('[ClaudeCode stderr]', text);
      }
    });

    this.process.on('exit', (code) => {
      console.log('[ClaudeCode] exited with code', code);
      const remaining = this.lineBuffer.flush();
      for (const line of remaining) {
        const parsed = parseStreamLine(line);
        if (parsed) this.onEvent?.(parsed);
      }
      this.onEvent?.({ type: 'done' });
      this.process = null;
    });

    this.process.on('error', (err) => {
      console.error('[ClaudeCode] spawn error:', err.message);
      this.onEvent?.({ type: 'error', error: err.message });
      this.process = null;
    });
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
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
