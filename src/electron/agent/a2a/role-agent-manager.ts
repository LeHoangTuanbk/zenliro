// Role-aware CLI runner — spawns either Claude CLI or Codex CLI depending on
// provider, with the role's system prompt applied. Captures final assistant
// text so the orchestrator can forward it as an A2A Message to the peer.
// See role-agent-spec.ts for the per-provider arg construction.

import { spawn, type ChildProcess } from 'child_process';
import { parseCodexLine } from '../codex-manager.js';
import { StreamLineBuffer, parseStreamLine, type ParsedStreamEvent } from '../stream-parser.js';
import { getShellEnv } from '../shell-env.js';
import { createLogger } from '../../logger/index.js';
import { buildClaudeSpec, buildCodexSpec } from './role-agent-spec.js';
import type { AgentRole } from './roles.js';

const log = createLogger('main/role-agent');

export type AgentProvider = 'claude' | 'codex';
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

  constructor(
    private role: AgentRole,
    private provider: AgentProvider = 'claude',
  ) {}

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

    const spec =
      this.provider === 'codex'
        ? buildCodexSpec(this.role, prompt, this.sessionId, options?.model)
        : buildClaudeSpec(this.role, prompt, this.sessionId, options?.model);
    const env = options?.env ? { ...getShellEnv(), ...options.env } : getShellEnv();
    const parser = this.provider === 'codex' ? parseCodexLine : parseStreamLine;

    log.info(
      `[${this.role.id}/${this.provider}] spawn ${spec.cmd} (${spec.args.length} args), prompt head=${prompt.slice(0, 80)}…`,
    );

    return new Promise<RunResult>((resolve) => {
      this.process = spawn(spec.cmd, spec.args, { stdio: ['pipe', 'pipe', 'pipe'], env });

      const handleEvent = (parsed: ParsedStreamEvent) => {
        if (parsed.type === 'text') this.accumulatedText += parsed.text;
        if (parsed.type === 'session_id' && parsed.sessionId) this.sessionId = parsed.sessionId;
        onEvent(parsed);
      };

      this.process.stdout?.on('data', (data: Buffer) => {
        for (const line of this.lineBuffer.feed(data.toString())) {
          const parsed = parser(line);
          if (parsed) handleEvent(parsed);
        }
      });
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.trim()) log.warn(`[${this.role.id}/${this.provider}] stderr:`, text);
      });

      this.process.on('exit', (code) => {
        for (const line of this.lineBuffer.flush()) {
          const parsed = parser(line);
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
        log.error(`[${this.role.id}/${this.provider}] spawn error:`, err.message);
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
