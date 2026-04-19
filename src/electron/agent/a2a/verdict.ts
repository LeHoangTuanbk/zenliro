// Reviewer verdict parsing. The Reviewer is instructed to end its reply with a
// fenced JSON block using A2A TaskState vocabulary, e.g.
//
//     ```json
//     {"state":"completed","score":9}
//     ```
//
// This file extracts the structured verdict. Why structured JSON instead of
// regex on "APPROVED"/"REVISE": the Reviewer's prose feedback can be in any
// language (Vietnamese, Chinese, Japanese, …); only the JSON block is a
// stable machine contract. Field names are language-independent and mirror
// `Task.status.state` from the A2A SDK.
//
// Mapping to our loop:
//   completed      → approved, end session
//   input-required → revise, editor works again next iteration
//   rejected       → hard reject (naturalness-gate failure); treated as
//                    revise for now, but caller can short-circuit if desired
//   anything else  → treated as revise (unknown / bad model output)
//
// Returns `null` when no parseable verdict block is found — the orchestrator
// treats this as implicit REVISE so a malformed reply never rubber-stamps.

import type { TaskState } from './types.js';

export type ReviewerVerdict = {
  state: TaskState;
  score: number;
  raw: string;
};

const VALID_STATES: ReadonlySet<TaskState> = new Set([
  'submitted',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
  'rejected',
  'auth-required',
  'unknown',
]);

// Matches fenced code blocks tagged `json` (case-insensitive). Non-greedy so
// multiple blocks can be found independently.
const FENCED_JSON_RE = /```(?:json|JSON)\s*([\s\S]*?)```/g;
// Fallback: any JSON object literal that contains a "state" key. Used when
// the model forgets the fence.
const LOOSE_STATE_RE = /\{[^{}]*"state"\s*:\s*"[^"]+"[^{}]*\}/g;

export function parseReviewerVerdict(text: string): ReviewerVerdict | null {
  if (!text) return null;

  // Prefer fenced JSON blocks — they're the instructed format. Scan all and
  // return the LAST valid one so trailing summaries override earlier drafts.
  const fenced = [...text.matchAll(FENCED_JSON_RE)].map((m) => m[1]);
  for (const raw of fenced.reverse()) {
    const v = tryParse(raw);
    if (v) return v;
  }

  // Fallback: find the LAST JSON-looking object containing a "state" key.
  const loose = text.match(LOOSE_STATE_RE);
  if (loose && loose.length > 0) {
    for (const raw of loose.reverse()) {
      const v = tryParse(raw);
      if (v) return v;
    }
  }

  return null;
}

function tryParse(raw: string): ReviewerVerdict | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (!parsed || typeof parsed !== 'object') return null;
    const state = (parsed as { state?: unknown }).state;
    if (typeof state !== 'string' || !VALID_STATES.has(state as TaskState)) return null;
    const scoreRaw = (parsed as { score?: unknown }).score;
    const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : 0;
    return { state: state as TaskState, score, raw };
  } catch {
    return null;
  }
}

export function isApproved(verdict: ReviewerVerdict | null): boolean {
  return verdict?.state === 'completed';
}
