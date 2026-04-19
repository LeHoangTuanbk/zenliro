// Role-aware Claude CLI runner. Like ClaudeCodeManager but takes an AgentRole
// so each agent (Editor / Reviewer) spawns with its own system prompt and
// tool allowlist. Captures the final assistant text of the run so the
// orchestrator can forward it as an A2A Message to the peer.
//
// One-shot per run: Claude CLI is invoked with --print, streams events, exits.
// The orchestrator calls `run` once per turn in the iteration loop.

import { spawn, type ChildProcess } from 'child_process';
import { CLAUDE_CLI } from '../const.js';
import { StreamLineBuffer, parseStreamLine, type ParsedStreamEvent } from '../stream-parser.js';
import { getShellEnv } from '../shell-env.js';
import { createLogger } from '../../logger/index.js';
import type { AgentRole } from './roles.js';

const log = createLogger('main/role-agent');

export type RoleStreamCallback = (event: ParsedStreamEvent) => void;

export type RunResult = {
  finalText: string;
  sessionId: string | null;
  exitCode: number | null;
};

export class RoleAgentManager {
  private process: ChildProcess | null = null;
  private lineBuffer = new StreamLineBuffer();
  private sessionId: string | null = null;
  private accumulatedText = '';

  constructor(private role: AgentRole) {}

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get roleId() {
    return this.role.id;
  }

  async run(
    prompt: string,
    onEvent: RoleStreamCallback,
    options?: { model?: string; env?: Record<string, string> },
  ): Promise<RunResult> {
    if (this.isRunning()) {
      this.process?.kill('SIGTERM');
      this.process = null;
    }
    this.lineBuffer = new StreamLineBuffer();
    this.accumulatedText = '';

    const args = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--system-prompt',
      this.role.systemPrompt,
      '--allowedTools',
      this.role.allowedMCPTools.join(','),
      '--dangerously-skip-permissions',
    ];

    if (options?.model) args.push('--model', options.model);
    if (this.sessionId) args.push('--resume', this.sessionId);
    args.push(prompt);

    const env = options?.env ? { ...getShellEnv(), ...options.env } : getShellEnv();

    log.info(`[${this.role.id}] spawn with ${args.length} args, prompt=${prompt.slice(0, 80)}…`);

    return new Promise<RunResult>((resolve) => {
      this.process = spawn(CLAUDE_CLI, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      const handleEvent = (parsed: ParsedStreamEvent) => {
        if (parsed.type === 'text') this.accumulatedText += parsed.text;
        if (parsed.type === 'session_id' && parsed.sessionId) this.sessionId = parsed.sessionId;
        onEvent(parsed);
      };

      this.process.stdout?.on('data', (data: Buffer) => {
        const lines = this.lineBuffer.feed(data.toString());
        for (const line of lines) {
          const parsed = parseStreamLine(line);
          if (parsed) handleEvent(parsed);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.trim()) log.warn(`[${this.role.id}] stderr:`, text);
      });

      this.process.on('exit', (code) => {
        const remaining = this.lineBuffer.flush();
        for (const line of remaining) {
          const parsed = parseStreamLine(line);
          if (parsed) handleEvent(parsed);
        }
        onEvent({ type: 'done' });
        this.process = null;
        resolve({
          finalText: this.accumulatedText.trim(),
          sessionId: this.sessionId,
          exitCode: code,
        });
      });

      this.process.on('error', (err) => {
        log.error(`[${this.role.id}] spawn error:`, err.message);
        onEvent({ type: 'error', error: err.message });
        this.process = null;
        resolve({
          finalText: this.accumulatedText.trim(),
          sessionId: this.sessionId,
          exitCode: null,
        });
      });
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
  }

  reset(): void {
    this.stop();
    this.sessionId = null;
  }
}
