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
import { isApproved, parseReviewerVerdict, type ReviewerVerdict } from './verdict.js';

const log = createLogger('main/orchestrator');

const MAX_ITERATIONS = 3;

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

      const verdict = parseReviewerVerdict(reviewerRes.finalText);
      const claimedApproved = isApproved(verdict);
      // On the final iteration we relax the minimum — a claimed APPROVAL is
      // almost always better than forcing REVISE into max-iterations-end,
      // which ships whatever the Editor did last.
      const isFinalIteration = iteration >= MAX_ITERATIONS;
      const requiredToolCalls = isFinalIteration ? 2 : MIN_REVIEWER_TOOL_CALLS;
      const verifiedApproved = claimedApproved && reviewerToolCalls >= requiredToolCalls;

      if (!verdict) {
        log.warn(
          `[reviewer] no parseable verdict JSON in reply; treating as REVISE. Text head: ${reviewerRes.finalText.slice(0, 120)}…`,
        );
      }

      // If Reviewer said completed without inspecting enough, rewrite the
      // forwarded message to make the rejection explicit so the Editor knows.
      const reviewerTextForLog = this.buildReviewerLog(
        reviewerRes.finalText,
        verdict,
        claimedApproved && !verifiedApproved,
        reviewerToolCalls,
        requiredToolCalls,
      );

      const reviewerMsg = textMessage('agent', reviewerTextForLog);
      this.postMessage('reviewer', 'editor', reviewerMsg, opts);

      if (verifiedApproved) {
        opts.onEvent({
          type: 'session-ended',
          sessionId: this.room.sessionId,
          reason: 'approved',
          detail: `Approved after ${iteration} iteration(s) — verdict state=completed, score=${verdict?.score ?? 'n/a'}, ${reviewerToolCalls} inspection tool calls.`,
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

  private buildReviewerLog(
    finalText: string,
    verdict: ReviewerVerdict | null,
    demoteToRevise: boolean,
    toolCalls: number,
    requiredTools: number,
  ): string {
    const body = finalText || '(no text output)';
    if (demoteToRevise) {
      const forced = `\`\`\`json\n{"state":"input-required","score":0}\n\`\`\``;
      return `[orchestrator] Reviewer tried to mark state=completed without enough inspection (${toolCalls} tool call${toolCalls === 1 ? '' : 's'}, need >= ${requiredTools}). Forcing revise.\n\n${forced}\n\nOriginal reviewer note:\n\n${body}`;
    }
    if (!verdict) {
      // No structured verdict — append an explicit one so downstream logs and
      // the Editor's next-iteration prompt show a clear state.
      const forced = `\`\`\`json\n{"state":"input-required","score":0}\n\`\`\``;
      return `[orchestrator] Reviewer did not emit a structured verdict block. Treating as revise.\n\n${forced}\n\n${body}`;
    }
    return body;
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
  const selfReviewReminder = `Before handing off, run your own self-review (get_screenshot + get_histogram + sample_colors on neutral surfaces if you touched color; check_skin_tones if people are in frame; Naturalness Gate). Fix anything you flag YOURSELF — do not pass broken work to the Reviewer. Only hand off when you honestly believe the result is approval-ready.`;
  if (iteration === 1) {
    return `USER REQUEST:\n${userPrompt}\n\nThis is iteration 1. Analyze, plan, apply your edits, then SELF-REVIEW before handing off. ${selfReviewReminder}\n\nWhen done, summarize what you changed, what you self-checked, and the key numbers.`;
  }
  return `USER REQUEST:\n${userPrompt}\n\nThis is iteration ${iteration}. The Reviewer responded:\n${reviewerFeedback}\n\nAddress the DOMINANT issue with the MINIMUM fix (prefer reducing an existing value toward 0 over adding new adjustments). Then SELF-REVIEW again. ${selfReviewReminder}\n\nIf self-review is clean and the Reviewer's remaining points are minor preferences, you may reply "No change this round; self-review passed, submitting as-is." Otherwise summarize the fix and your self-check results.`;
}

function buildReviewerPrompt(userPrompt: string, iteration: number, editorText: string): string {
  const bar =
    iteration === 1
      ? 'Iteration 1 bar: score >= 9 AND natural AND on-brief. Default to state="input-required".'
      : iteration === 2
        ? 'Iteration 2 bar: score >= 7 AND natural AND on-brief. Stop nitpicking small preferences — lean toward state="completed" if decent and natural.'
        : `Iteration ${iteration} (LAST) bar: score >= 6 AND natural AND roughly on-brief. Max-iterations ships whatever the Editor did last, which is worse than approving a decent result now.`;
  return [
    `USER REQUEST (original):\n${userPrompt}`,
    `EDITOR'S LATEST MESSAGE (iteration ${iteration}):\n${editorText}`,
    `Inspect the photo via the read-only MCP tools. Run the NATURALNESS GATE first: magenta/purple snow or clouds, neon foliage, plastic skin, dead-black shadows, halo glows, unnatural skies → set state="rejected" regardless of score.`,
    bar,
    `If revising, give AT MOST 3 concrete changes. Prefer REDUCING existing values toward 0 over adding new adjustments (a cast is almost always fixed by pulling back the value that caused it, not by counter-edits).`,
    // Structured verdict contract — machine-readable, language-independent.
    `RESPONSE FORMAT (REQUIRED): your feedback prose may be in any language, but you MUST end your reply with exactly one fenced JSON block using A2A TaskState vocabulary:\n\n\`\`\`json\n{"state":"completed|input-required|rejected","score":<0-10 integer>}\n\`\`\`\n\nSemantics: "completed" = approved, "input-required" = editor should revise, "rejected" = naturalness gate failed (hard reject). The orchestrator parses only this JSON block — prose alone (e.g. the word "APPROVED") is NOT sufficient.`,
  ].join('\n\n');
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
