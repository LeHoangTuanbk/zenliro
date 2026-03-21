import { spawn, type ChildProcess } from 'child_process';
import { CLAUDE_CLI } from './const.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { StreamLineBuffer, parseStreamLine, type ParsedStreamEvent } from './stream-parser.js';

export type StreamCallback = (event: ParsedStreamEvent) => void;

export class ClaudeCodeManager {
  private process: ChildProcess | null = null;
  private lineBuffer = new StreamLineBuffer();
  private onEvent: StreamCallback | null = null;

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  async start(onEvent: StreamCallback): Promise<void> {
    if (this.isRunning()) return;

    this.onEvent = onEvent;

    // MCP server is registered globally in ~/.claude.json — no need for --mcp-config
    const args = [
      '--output-format', 'stream-json',
      '--verbose',
      '--system-prompt', SYSTEM_PROMPT,
      '--allowedTools', 'mcp__zenliro__*',
    ];

    this.process = spawn(CLAUDE_CLI, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = this.lineBuffer.feed(data.toString());
      for (const line of lines) {
        const parsed = parseStreamLine(line);
        if (parsed) this.onEvent?.(parsed);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[ClaudeCode stderr]', data.toString());
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

  sendMessage(text: string): void {
    if (!this.process?.stdin?.writable) {
      this.onEvent?.({ type: 'error', error: 'Claude Code process not running' });
      return;
    }
    this.process.stdin.write(text + '\n');
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.stdin?.end();
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
}
