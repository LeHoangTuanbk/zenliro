// Multi-agent orchestrator — ping-pong iteration loop between Editor and
// Reviewer. Model:
//
//   Turn 1  Editor runs with user's original prompt. Applies edits via MCP
//           write tools. Its final assistant text is treated as "message to
//           Reviewer" and posted into the Room.
//   Turn 2  Reviewer runs with a prompt that quotes the user's original
//           request + Editor's summary. Reviewer uses read-only MCP tools to
//           inspect the image state and returns a verdict: APPROVED / REVISE.
//   Turn 3+ On REVISE, Editor runs again with Reviewer's feedback appended.
//           Loop continues until APPROVED or max iterations.
//
// No custom MCP a2a_* tools required: each agent is a standard Claude CLI
// session with role-specific prompt. Inter-agent communication is implemented
// by the orchestrator reading each agent's final text and forwarding it.
// When we add HTTP A2A transport later, the same flow runs — just with
// SDK-managed Tasks instead of final-text parsing.

import { createLogger } from '../../logger/index.js';
import { AgentRoom } from './room.js';
import { EDITOR_ROLE, REVIEWER_ROLE } from './roles.js';
import { RoleAgentManager } from './role-agent-manager.js';
import type { AgentId, OrchestratorEvent, Message } from './types.js';
import type { ParsedStreamEvent } from '../stream-parser.js';

const log = createLogger('main/orchestrator');

const MAX_ITERATIONS = 3;
const APPROVED_RE = /APPROVED/i;

export type OrchestratorOptions = {
  model?: string;
  env?: Record<string, string>;
  onEvent: (ev: OrchestratorEvent) => void;
  onAgentStream: (agentId: AgentId, event: ParsedStreamEvent) => void;
};

export class EditorReviewerOrchestrator {
  private room = new AgentRoom();
  private editor = new RoleAgentManager(EDITOR_ROLE);
  private reviewer = new RoleAgentManager(REVIEWER_ROLE);
  private cancelled = false;

  get sessionId() {
    return this.room.sessionId;
  }

  async run(userPrompt: string, opts: OrchestratorOptions): Promise<void> {
    this.room.registerAgent('editor', EDITOR_ROLE.card);
    this.room.registerAgent('reviewer', REVIEWER_ROLE.card);

    opts.onEvent({
      type: 'session-started',
      sessionId: this.room.sessionId,
      agentIds: ['editor', 'reviewer'],
    });
    opts.onEvent({
      type: 'agent-joined',
      sessionId: this.room.sessionId,
      agentId: 'editor',
      card: EDITOR_ROLE.card,
    });
    opts.onEvent({
      type: 'agent-joined',
      sessionId: this.room.sessionId,
      agentId: 'reviewer',
      card: REVIEWER_ROLE.card,
    });

    // User's initial request as a user→editor Room message so it shows up in
    // the conversation popup.
    this.postMessage('user' as AgentId, 'editor', textMessage('user', userPrompt), opts);

    let iteration = 1;
    let editorFeedback = '';

    while (iteration <= MAX_ITERATIONS) {
      if (this.cancelled) break;
      this.room.advanceIteration();

      // ── Editor turn ────────────────────────────────────────────────
      const editorPrompt = buildEditorPrompt(userPrompt, iteration, editorFeedback);
      const editorRes = await this.editor.run(
        editorPrompt,
        (ev) => opts.onAgentStream('editor', ev),
        {
          model: opts.model,
          env: opts.env,
        },
      );
      if (this.cancelled) break;

      const editorMsg = textMessage('agent', editorRes.finalText || '(no text output)');
      this.postMessage('editor', 'reviewer', editorMsg, opts);

      // ── Reviewer turn ──────────────────────────────────────────────
      const reviewerPrompt = buildReviewerPrompt(userPrompt, iteration, editorRes.finalText);
      const reviewerRes = await this.reviewer.run(
        reviewerPrompt,
        (ev) => opts.onAgentStream('reviewer', ev),
        {
          model: opts.model,
          env: opts.env,
        },
      );
      if (this.cancelled) break;

      const reviewerMsg = textMessage('agent', reviewerRes.finalText || '(no text output)');
      this.postMessage('reviewer', 'editor', reviewerMsg, opts);

      // ── Verdict parsing ───────────────────────────────────────────
      if (this.isApproved(reviewerRes.finalText)) {
        opts.onEvent({
          type: 'session-ended',
          sessionId: this.room.sessionId,
          reason: 'approved',
          detail: `Approved after ${iteration} iteration(s).`,
        });
        this.cleanup();
        return;
      }

      editorFeedback = reviewerRes.finalText;
      iteration += 1;
    }

    if (this.cancelled) {
      opts.onEvent({ type: 'session-ended', sessionId: this.room.sessionId, reason: 'cancelled' });
    } else {
      opts.onEvent({
        type: 'session-ended',
        sessionId: this.room.sessionId,
        reason: 'max-iterations',
        detail: `Stopped after ${MAX_ITERATIONS} iterations without approval.`,
      });
    }
    this.cleanup();
  }

  cancel(): void {
    this.cancelled = true;
    this.editor.stop();
    this.reviewer.stop();
  }

  private cleanup() {
    this.editor.reset();
    this.reviewer.reset();
    this.room.close();
  }

  private postMessage(
    from: AgentId,
    to: AgentId | 'broadcast',
    message: Message,
    opts: OrchestratorOptions,
  ) {
    const env = this.room.send({ from, to, message });
    opts.onEvent({ type: 'message', sessionId: this.room.sessionId, envelope: env });
  }

  private isApproved(text: string): boolean {
    if (!text) return false;
    // Look for APPROVED signal at the start or in a JSON block. Accept plain
    // "APPROVED" or `{"verdict":"approved"}`.
    if (APPROVED_RE.test(text.slice(0, 80))) return true;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const obj = JSON.parse(match[0]);
        if (obj?.verdict === 'approved' || obj?.approved === true) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }
}

function textMessage(role: 'user' | 'agent', text: string): Message {
  return {
    kind: 'message',
    messageId: cryptoRandom(),
    role,
    parts: [{ kind: 'text', text }],
  };
}

function cryptoRandom(): string {
  // Small helper — avoids importing randomUUID in this module twice.
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEditorPrompt(
  userPrompt: string,
  iteration: number,
  reviewerFeedback: string,
): string {
  if (iteration === 1) {
    return `USER REQUEST:\n${userPrompt}\n\nThis is iteration 1. Analyze, plan, and apply your edits. After applying, briefly explain what you changed and why.`;
  }
  return `USER REQUEST:\n${userPrompt}\n\nThis is iteration ${iteration}. The Reviewer responded:\n${reviewerFeedback}\n\nIncorporate their feedback and apply further adjustments. Explain what you changed.`;
}

function buildReviewerPrompt(userPrompt: string, iteration: number, editorText: string): string {
  return `USER REQUEST (original):\n${userPrompt}\n\nEDITOR'S LATEST MESSAGE (iteration ${iteration}):\n${editorText}\n\nInspect the current photo state via the read-only MCP tools. Score the result 0-10. If score >= 7 and no major issues, respond with "APPROVED" on the first line followed by a short explanation. Otherwise, respond with a JSON verdict:\n{"verdict":"revise","score":N,"feedback":"...","specific_changes":[{"tool":"set_adjustments","param":"highlights","suggested_value":-25}]}`;
}

let currentOrchestrator: EditorReviewerOrchestrator | null = null;

export function getCurrentOrchestrator(): EditorReviewerOrchestrator | null {
  return currentOrchestrator;
}

export function startOrchestrator(
  userPrompt: string,
  opts: OrchestratorOptions,
): EditorReviewerOrchestrator {
  if (currentOrchestrator) currentOrchestrator.cancel();
  const orch = new EditorReviewerOrchestrator();
  currentOrchestrator = orch;
  orch
    .run(userPrompt, opts)
    .catch((err) => {
      log.error('orchestrator failed:', err);
      opts.onEvent({
        type: 'session-ended',
        sessionId: orch.sessionId,
        reason: 'error',
        detail: String(err),
      });
    })
    .finally(() => {
      if (currentOrchestrator === orch) currentOrchestrator = null;
    });
  return orch;
}

export function cancelCurrentOrchestrator(): void {
  currentOrchestrator?.cancel();
  currentOrchestrator = null;
}
