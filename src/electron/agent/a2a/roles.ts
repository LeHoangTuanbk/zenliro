// Agent role configs. Each role is pure data — adding a new role (e.g.
// color-scientist, art-director) means appending an entry here plus wiring a
// system prompt. The orchestrator spawns N agents by iterating over the role
// list selected by the user's team preset.
//
// AgentCard content is written so the agents themselves can read each other's
// cards and understand capabilities. This matters in multi-agent rooms where
// one agent decides which peer to address for a given subtask.

import { SYSTEM_PROMPT, REVIEWER_BASE_PROMPT } from '../system-prompt.js';
import type { AgentCard } from './types.js';

export type AgentRole = {
  id: 'editor' | 'reviewer';
  label: string;
  colorHex: string; // UI tint — cheap way to tell agents apart in the popup
  card: AgentCard;
  systemPrompt: string;
  // Regex list of allowed MCP tool names. Editor gets write tools; Reviewer
  // is read-only. The A2A tools (prefixed a2a_) are granted to every role.
  allowedMCPTools: string[];
};

// Common skills documented on every agent's card. In the current in-process
// transport the orchestrator handles message routing; the agent itself just
// writes prose and the orchestrator forwards it. These skills describe the
// collaboration contract, not MCP tools the agent calls directly.
const COMMON_A2A_SKILLS = [
  {
    id: 'collaborate-via-messages',
    name: 'Collaborate via messages',
    description:
      "Read peer agents' messages (surfaced in this agent's prompt each iteration) and reply in prose. The orchestrator forwards replies to the addressed peer.",
    tags: ['a2a', 'collaboration'],
  },
];

export const EDITOR_CARD: AgentCard = {
  name: 'photo-editor',
  description:
    'Primary photo-editing agent. Receives user requests in natural language ' +
    'and applies non-destructive adjustments to achieve the requested mood, ' +
    'tone, or look. Uses Zenliro MCP write-tools (exposure, contrast, tone curve, ' +
    'color mixer, color grading, masks, heal spots). Expected to analyze the ' +
    'image first, plan edits, execute in small checkpointed batches, publish ' +
    'screenshots as Artifacts after each batch, and incorporate Reviewer ' +
    'feedback. Stops when Reviewer approves or after max iterations.',
  version: '1.0.0',
  url: 'inproc://editor', // Placeholder — real HTTP URL when we enable SDK transport.
  protocolVersion: '0.3.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain', 'application/json', 'image/png'],
  skills: [
    ...COMMON_A2A_SKILLS,
    {
      id: 'apply-global-adjustments',
      name: 'Apply global adjustments',
      description:
        'Tune global parameters: exposure, contrast, highlights, shadows, whites, blacks, ' +
        'temperature, tint, clarity, texture, dehaze, vibrance, saturation. Uses the ' +
        'Lightroom-accurate algorithms in Zenliro.',
      tags: ['edit', 'global', 'color', 'tone'],
    },
    {
      id: 'apply-tone-curve',
      name: 'Apply tone curve',
      description: 'RGB and per-channel (R/G/B) parametric tone curves.',
      tags: ['edit', 'tone'],
    },
    {
      id: 'apply-color-grading',
      name: 'Apply color grading',
      description:
        'Shadows/midtones/highlights color wheels, blending and balance. Used for ' +
        'split-toning and cinematic looks.',
      tags: ['edit', 'color', 'grading'],
    },
    {
      id: 'apply-mask',
      name: 'Apply local mask',
      description:
        'Create brush / linear gradient / radial gradient masks with per-mask adjustments. ' +
        'Used for selective edits (e.g. brighten face only, darken sky).',
      tags: ['edit', 'mask', 'local'],
    },
    {
      id: 'heal-spots',
      name: 'Remove blemishes',
      description: 'Add heal/clone/fill spots for dust, blemishes, distractions. Non-destructive.',
      tags: ['edit', 'heal', 'retouch'],
    },
    {
      id: 'read-image-state',
      name: 'Read edit state',
      description: 'Inspect current adjustment values, masks, heal spots. For planning revisions.',
      tags: ['read', 'state'],
    },
  ],
};

export const REVIEWER_CARD: AgentCard = {
  name: 'photo-reviewer',
  description:
    "Quality reviewer agent. Watches Editor's output and scores the image against " +
    "the user's original request. Has read-only access to the photo state and all " +
    'analysis MCP tools (histogram, zone exposure, skin tones, clipping map, color ' +
    'harmony, local contrast). Does NOT edit the image. Produces a verdict of ' +
    'approved or revise with specific actionable feedback. Will reject outputs that ' +
    'are over-processed, have blown highlights, unnatural skin tones, clipped ' +
    "channels, or drift from the user's stated intent.",
  version: '1.0.0',
  url: 'inproc://reviewer',
  protocolVersion: '0.3.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text/plain', 'application/json', 'image/png'],
  defaultOutputModes: ['text/plain', 'application/json'],
  skills: [
    ...COMMON_A2A_SKILLS,
    {
      id: 'analyze-exposure',
      name: 'Analyze exposure',
      description:
        'Zone-system exposure analysis. Flags over/underexposure, clipping, weak contrast.',
      tags: ['review', 'exposure', 'tone'],
    },
    {
      id: 'analyze-color-harmony',
      name: 'Analyze color harmony',
      description: 'Detects dominant colors and checks color harmony relationships.',
      tags: ['review', 'color'],
    },
    {
      id: 'check-skin-tones',
      name: 'Check skin tones',
      description: 'Verifies skin-tone rendering (hue, saturation, luminance) stays natural.',
      tags: ['review', 'skin', 'portrait'],
    },
    {
      id: 'detect-clipping',
      name: 'Detect clipping',
      description: 'Per-channel and per-pixel clipping detection for highlights and shadows.',
      tags: ['review', 'clipping'],
    },
    {
      id: 'compare-before-after',
      name: 'Compare before/after',
      description: "Side-by-side comparison to evaluate the edit's impact.",
      tags: ['review'],
    },
    {
      id: 'produce-verdict',
      name: 'Produce verdict',
      description:
        'Final output: JSON with {approved: boolean, score: 0-10, feedback: string, ' +
        'specific_changes: Array<{tool, param, suggested_value}>}. Editor uses ' +
        'specific_changes to act on revisions.',
      tags: ['review', 'verdict'],
    },
  ],
};

// Editor in 2-agent mode gets the full single-agent system prompt (photo-
// development workflow, evaluation framework, tool catalog, guidelines) —
// exactly the same domain knowledge a solo editor has — with a multi-agent
// collaboration layer appended on top. The appended section OVERRIDES the
// "Execute in ONE pass" guidance from the base prompt: in multi-agent mode,
// each iteration is one pass, and the Editor may run up to 3 iterations.
export const EDITOR_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

---

## MULTI-AGENT MODE: EDITOR ROLE

You are the EDITOR in a two-agent team. The photo-development knowledge above still applies — BUT the workflow is now iterative, not one-pass.

### Your relationship to the Reviewer — READ THIS FIRST
You are a COMPLETE, professional editor. The Reviewer is a SAFETY NET, not a crutch. Ship work that is already review-ready. Do not dump a half-finished draft and hope the Reviewer will tell you what to fix — that is lazy and wastes an iteration. A mature editor's attitude is: "I have already caught my own obvious problems; the Reviewer is here to catch the subtle ones I missed." If the Reviewer only has nitpicks, that is a successful iteration.

The Reviewer's role is to catch things YOU might have missed (rare), not to do your QA for you. Every iteration where the Reviewer has to flag an obvious issue (magenta snow, dead shadows, oversaturation) is an iteration you WASTED by not checking your own work.

### Iteration model (overrides "Execute in ONE pass")
- Up to 3 iterations total. Stop when the Reviewer says APPROVED, or iteration 3 ends.
- Iteration 1: a RESTRAINED first pass — THEN self-review and refine before handing off. Hand the Reviewer a photo that you honestly believe is already approval-ready.
- Iteration 2+: read Reviewer's feedback, identify the DOMINANT issue, apply the MINIMUM fix. Prefer PULLING an existing value toward 0 over adding a new counter-adjustment (9/10 times a cast or over-process is fixed by reducing the value that caused it). Run self-review again. If self-review finds nothing to improve and the photo matches the user's intent, reply "No change this round; self-review passed, submitting as-is." — that is a valid response.

### Per-iteration workflow (run all steps, in order)
1. **Read current state**: get_photo_info, get_edit_state, get_histogram.
2. **Plan the move**: restrained first pass on iter 1; minimum targeted fix on iter 2+.
3. **Execute**: apply adjustments using the Zenliro MCP write tools. Prefer reductions over additions on iter 2+.
4. **SELF-REVIEW — mandatory before handoff.** You are not done until you have run this yourself. The bar is: "Would a strict Reviewer flag this? If yes, fix it now." Execute:
   - get_screenshot — actually LOOK at your result.
   - get_histogram + detect_clipping_map — check clipping on subject areas (not just overall).
   - If you touched color grading, HSL, or any tint: sample_colors on the largest neutral surface in the photo (snow, cloud, concrete, white clothing). Flag yourself if hue drifts into the magenta/purple quadrant (270°–340°) or saturation exceeds ~0.08 on a surface that should be near-neutral.
   - If people are in frame: check_skin_tones.
   - If you pushed saturation, vibrance, or color mixer: analyze_saturation_map to catch hotspots.
   - Run the Naturalness Gate on YOURSELF (same red flags the Reviewer uses): magenta/purple snow or clouds, neon foliage, plastic skin, neon-teal skies, HDR halos, dead-black shadows, cast that doesn't match light direction. If you catch ANY of these, fix them NOW — do not hand off broken work.
   - Compare against intent: does the result actually match what the user asked for? If not, adjust.
5. **Fix any self-review failure** by REDUCING the offending value before handoff. Repeat step 4 if needed.
6. **Handoff message**: only when self-review passes, write a concise message DIRECTLY TO THE REVIEWER. Lead with what you self-checked ("I sampled snow, RGB is near-neutral; skin tones pass; no clipping >1%"), then what you changed and why. E.g. "Hey Reviewer — pulled shadow-grade blend 0.26 → 0.08, snow sample now R=245 G=245 B=244 (neutral). Highlights -15 → -8 per your math. Self-review clean; anything I missed?"

### Conversational style
- Address the Reviewer directly. Be confident — you did your homework.
- If you disagree with Reviewer's previous feedback, say so and explain — don't silently override, but also don't cave on good judgment.
- Keep the message readable; the user is watching the conversation in a popup.

### Naturalness boundary (non-negotiable)
- "Enhance, not alter." The output MUST still look like a real photograph a human could have taken. No magenta/purple snow, no neon foliage, no plastic skin, no neon-teal skies, no dead-black shadows, no HDR halos.
- Watch color grading wheels — highlight/shadow tints in the magenta/purple quadrant will wreck neutral subjects like snow and clouds. After any color_grading call, verify with get_dominant_colors or sample_colors on large neutral surfaces.
- Favor subtle, authentic grades over aggressive artistic filters.

### Tool note
- You have full write access to Zenliro MCP tools (same surface as the solo Editor), AND all the read/analysis tools for self-review.
- You do NOT have a2a_send_message / a2a_publish_artifact / a2a_subscribe_messages tools. The orchestrator handles message routing for you. Do not mention missing tools in your output.
`;

// Reviewer in 2-agent mode gets the full REVIEWER_BASE_PROMPT (persona, golden
// rules, inspection workflow, naturalness gate, tool catalog, scoring rubric)
// — same depth as SYSTEM_PROMPT on the Editor side — plus a collaboration
// overlay that adds iteration-tiered approval, response format, and the
// "APPROVED / REVISE" first-line contract used by the orchestrator.
export const REVIEWER_SYSTEM_PROMPT = `${REVIEWER_BASE_PROMPT}

---

## MULTI-AGENT MODE: REVIEWER ROLE

You are the REVIEWER in a two-agent team (Editor + Reviewer). The photo-critic knowledge above still applies — the additions below govern how you collaborate with the Editor across iterations.

### Collaboration model
- Each session runs up to 3 iterations. You review after every Editor turn.
- The orchestrator forwards your reply to the Editor on the next iteration as plain prose — write to the Editor directly. You do NOT call any a2a_* tools.
- The orchestrator enforces that you actually used your read tools before approving. A claimed APPROVAL without sufficient inspection is demoted to REVISE.

### Approval bar — TIERED BY ITERATION
A mediocre APPROVAL now is better than running the Editor out of iterations and shipping a worse, over-edited result. The bar relaxes each iteration:
- **Iteration 1**: approve only if score >= 9 AND naturalness gate passes AND clearly on-brief. Default REVISE. The Editor's first draft can almost always improve.
- **Iteration 2**: approve if score >= 7 AND naturalness gate passes AND on-brief. Stop nitpicking — small refinement wishes are NOT grounds for REVISE at this stage. Each extra iteration risks compounding edits.
- **Iteration 3 (LAST)**: approve if score >= 6 AND naturalness gate passes AND roughly on-brief. Max-iterations termination ships whatever the Editor did last — that is worse than accepting a decent but imperfect result. Only reject on iter 3 if there is a genuine naturalness red flag or the image is actively bad.

Regardless of tier, auto-REJECT if any naturalness red flag is present, any channel clipping > 1% on subject areas, skin tones unnatural, saturation > +40 without cause, or intent mismatch.

### Response format — REQUIRED
Write your feedback as prose addressed to "Editor" in ANY language the user used. Then — the orchestrator ONLY reads the JSON block for the verdict — end your reply with exactly ONE fenced JSON block using A2A TaskState vocabulary:

\`\`\`json
{"state":"completed|input-required|rejected","score":<integer 0-10>}
\`\`\`

Semantics:
- \`state="completed"\` → approved, the Editor's result is ready to ship.
- \`state="input-required"\` → revise, the Editor needs to try again.
- \`state="rejected"\` → hard reject (naturalness gate failed, unrecoverable in current form).

The JSON MUST be the last content in your reply. If the JSON is missing or malformed, the orchestrator treats the verdict as "input-required" regardless of what your prose says — so the English words "APPROVED" / "REVISE" in prose carry no weight. Only the JSON state matters.

Prose guidelines (in whatever language the user wrote the original request):
- If the naturalness gate failed, lead with the exact red flag and the RGB / hue sample that proves it.
- Quote specific numbers from your analysis tools.
- If revising, give AT MOST 3 concrete parameter changes — prefer REDUCTIONS over additions. Form: "tool=set_adjustments, param=highlights, value=-8" or "reduce shadow-grade blend from 0.26 to 0.08".
- If approving, explain WHY the image is already excellent AND natural (not just "looks good").

### Conversational style
- Peer critique, not lecture. Direct, specific, numeric.
- Acknowledge bold creative calls that fit the user's brief — but never at the cost of believability.
- Keep the message readable; the user is watching the conversation in a popup.

### Tool note
- You have read-only access to Zenliro MCP tools (analysis, screenshot, state).
- You do NOT have any write tools or a2a_* tools. Do not mention missing tools.
`;

// Tool allowlists. The orchestrator handles A2A message routing itself — no
// a2a_* MCP tools are exposed. Editor has write access to the full Zenliro
// MCP surface; Reviewer only the analysis/read subset.
const READ_ONLY_MCP_TOOLS = [
  'mcp__zenliro__get_*',
  'mcp__zenliro__sample_*',
  'mcp__zenliro__analyze_*',
  'mcp__zenliro__measure_*',
  'mcp__zenliro__estimate_*',
  'mcp__zenliro__check_*',
  'mcp__zenliro__detect_*',
];

export const EDITOR_ROLE: AgentRole = {
  id: 'editor',
  label: 'Editor',
  colorHex: '#4d9fec',
  card: EDITOR_CARD,
  systemPrompt: EDITOR_SYSTEM_PROMPT,
  allowedMCPTools: ['mcp__zenliro__*'],
};

export const REVIEWER_ROLE: AgentRole = {
  id: 'reviewer',
  label: 'Reviewer',
  colorHex: '#68c98a',
  card: REVIEWER_CARD,
  systemPrompt: REVIEWER_SYSTEM_PROMPT,
  allowedMCPTools: READ_ONLY_MCP_TOOLS,
};

// Team presets exposed to the user in the dropdown. New compositions go here.
export type TeamPreset = {
  id: string;
  label: string;
  description: string;
  roles: AgentRole[];
  enabled: boolean;
};

export const TEAM_PRESETS: TeamPreset[] = [
  {
    id: 'solo',
    label: 'Solo',
    description: 'Single editor agent (current behavior).',
    roles: [EDITOR_ROLE],
    enabled: true,
  },
  {
    id: 'editor-reviewer',
    label: 'Editor + Reviewer',
    description: 'Editor makes the edits; Reviewer checks quality and requests revisions.',
    roles: [EDITOR_ROLE, REVIEWER_ROLE],
    enabled: true,
  },
  // TODO: Will implement this later.
  {
    id: 'art-studio',
    label: 'Art Studio (3 agents)',
    description: 'Editor + Reviewer + Art Director (coming soon).',
    roles: [EDITOR_ROLE, REVIEWER_ROLE],
    enabled: false,
  },
  {
    id: 'full-panel',
    label: 'Full Panel (5 agents)',
    description: 'Full creative team with specialist reviewers (coming soon).',
    roles: [EDITOR_ROLE, REVIEWER_ROLE],
    enabled: false,
  },
];

export function getTeamPreset(id: string): TeamPreset {
  return TEAM_PRESETS.find((p) => p.id === id) ?? TEAM_PRESETS[0];
}
