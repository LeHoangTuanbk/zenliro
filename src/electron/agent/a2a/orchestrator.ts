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
// Verdict must be the very first token on the first line — no loose "APPROVED"
// mentions in prose. Case-sensitive to prevent accidental matches.
const APPROVED_PREFIX_RE = /^APPROVED\b/;

// Minimum number of read tool calls the Reviewer must have made before we
// trust an APPROVED verdict. The mandatory checklist has 10 items including
// a sample_colors check for naturalness — 5 is a reasonable floor to force
// real inspection without demanding the full checklist on trivial cases.
const MIN_REVIEWER_TOOL_CALLS = 5;

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
      opts.onEvent({
        type: 'agent-turn-started',
        sessionId: this.room.sessionId,
        agentId: 'editor',
        iteration,
      });
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
      // Count tool_use events so we can enforce "Reviewer actually looked
      // before approving". If the count is too low we override APPROVED
      // back to REVISE and tell the Editor to expect more scrutiny next time.
      opts.onEvent({
        type: 'agent-turn-started',
        sessionId: this.room.sessionId,
        agentId: 'reviewer',
        iteration,
      });
      let reviewerToolCalls = 0;
      const reviewerPrompt = buildReviewerPrompt(userPrompt, iteration, editorRes.finalText);
      const reviewerRes = await this.reviewer.run(
        reviewerPrompt,
        (ev) => {
          if (ev.type === 'tool_use') reviewerToolCalls += 1;
          opts.onAgentStream('reviewer', ev);
        },
        {
          model: opts.model,
          env: opts.env,
        },
      );
      if (this.cancelled) break;

      const claimedApproved = this.isApproved(reviewerRes.finalText);
      // On the final iteration we relax the minimum — a claimed APPROVAL is
      // almost always better than forcing REVISE into max-iterations-end,
      // which ships whatever the Editor did last.
      const isFinalIteration = iteration >= MAX_ITERATIONS;
      const requiredToolCalls = isFinalIteration ? 2 : MIN_REVIEWER_TOOL_CALLS;
      const verifiedApproved = claimedApproved && reviewerToolCalls >= requiredToolCalls;

      // If Reviewer said APPROVED without inspecting enough, rewrite the
      // forwarded message to make the rejection explicit so the Editor knows.
      const reviewerTextForLog =
        claimedApproved && !verifiedApproved
          ? `REVISE. Score: 0/10.\n\n[orchestrator] Reviewer tried to approve without enough inspection (${reviewerToolCalls} tool call${reviewerToolCalls === 1 ? '' : 's'}, need >= ${requiredToolCalls}). Forcing revision. Their original note:\n\n${reviewerRes.finalText}`
          : reviewerRes.finalText || '(no text output)';

      const reviewerMsg = textMessage('agent', reviewerTextForLog);
      this.postMessage('reviewer', 'editor', reviewerMsg, opts);

      if (verifiedApproved) {
        opts.onEvent({
          type: 'session-ended',
          sessionId: this.room.sessionId,
          reason: 'approved',
          detail: `Approved after ${iteration} iteration(s) (${reviewerToolCalls} inspection tool calls).`,
        });
        this.cleanup();
        return;
      }

      editorFeedback = reviewerTextForLog;
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
    // Only accept verdict if it's the FIRST token on the first non-empty line.
    // Prevents false positives from reviewers who mention "APPROVED" in prose
    // while actually requesting revisions.
    const firstLine = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (!firstLine) return false;
    return APPROVED_PREFIX_RE.test(firstLine);
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
  const bar =
    iteration === 1
      ? 'Iteration 1 bar: score >= 9 AND natural AND on-brief. Default REVISE.'
      : iteration === 2
        ? 'Iteration 2 bar: score >= 7 AND natural AND on-brief. Stop nitpicking small preferences — approve if it is decent and natural.'
        : `Iteration ${iteration} (LAST) bar: score >= 6 AND natural AND roughly on-brief. Max-iterations ships whatever the Editor did last, which is worse than approving a decent result now.`;
  return `USER REQUEST (original):\n${userPrompt}\n\nEDITOR'S LATEST MESSAGE (iteration ${iteration}):\n${editorText}\n\nInspect the photo via the read-only MCP tools. Run the NATURALNESS GATE first: magenta/purple snow or clouds, neon foliage, plastic skin, dead-black shadows, halo glows, unnatural skies → auto-REVISE regardless of score.\n\n${bar}\n\nIf revising, give AT MOST 3 concrete changes. Prefer REDUCING existing values toward 0 over adding new adjustments (a cast is almost always fixed by pulling back the value that caused it, not by counter-edits). Start line 1 with "APPROVED. Score: N/10." or "REVISE. Score: N/10." exactly.`;
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
