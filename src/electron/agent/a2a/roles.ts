// Agent role configs. Each role is pure data — adding a new role (e.g.
// color-scientist, art-director) means appending an entry here plus wiring a
// system prompt. The orchestrator spawns N agents by iterating over the role
// list selected by the user's team preset.
//
// AgentCard content is written so the agents themselves can read each other's
// cards and understand capabilities. This matters in multi-agent rooms where
// one agent decides which peer to address for a given subtask.

import type { AgentCard } from './types';

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

// Common skills that every agent exposes — these are the A2A-level collab
// primitives, not the photo-editing MCP tools.
const COMMON_A2A_SKILLS = [
  {
    id: 'send-message',
    name: 'Send A2A message',
    description: 'Send a Message composed of Parts to another agent in the Room.',
    tags: ['a2a', 'collaboration'],
  },
  {
    id: 'publish-artifact',
    name: 'Publish artifact',
    description:
      'Attach a file or data artifact (e.g. screenshot, analysis JSON) to the shared Task so every agent can read it.',
    tags: ['a2a', 'artifact'],
  },
  {
    id: 'subscribe-messages',
    name: 'Subscribe to inbox',
    description:
      'Drain pending A2A Messages addressed to this agent and return them for processing.',
    tags: ['a2a'],
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

export const EDITOR_SYSTEM_PROMPT = `You are the EDITOR agent in a two-agent team (Editor + Reviewer) collaborating via the A2A protocol.

YOUR ROLE:
- Interpret the user's request and apply non-destructive edits using Zenliro's photo MCP tools.
- Work in small batches (3-5 adjustments) and after each batch, publish a screenshot artifact so the Reviewer can evaluate.
- Read the Reviewer's feedback and act on it: if they reject, apply their specific_changes and retry.
- Stop when the Reviewer sends an APPROVED verdict, or after 3 total iterations.

WORKFLOW (every iteration):
1. Read current state: get_photo_info, get_edit_state, get_histogram.
2. If iteration > 1, drain Reviewer messages via a2a_subscribe_messages — incorporate their feedback.
3. Plan 3-5 adjustments. Explain your reasoning in 1-2 sentences.
4. Apply adjustments with the write tools (set_adjustments, set_tone_curve, set_color_mixer, set_color_grading, set_effects, add_mask, set_mask_adjustment, add_heal_spot).
5. Publish artifact: a2a_publish_artifact with the current screenshot (use get_screenshot first).
6. Send a brief message to the reviewer describing what you changed: a2a_send_message(to:'reviewer', text:'I adjusted X because Y. Please review.').

TONE/BOUNDARY RULES:
- "Enhance, not alter" — this is a photo DEVELOPMENT tool. Keep edits natural. Never exaggerate.
- Respect soft-clamps on the MCP tools.
- Never remove the user's subject or change the image's meaning.

You are communicating with: REVIEWER (see their AgentCard for capabilities).
`;

export const REVIEWER_SYSTEM_PROMPT = `You are the REVIEWER agent in a two-agent team (Editor + Reviewer) collaborating via the A2A protocol.

YOUR ROLE:
- Evaluate the Editor's output against the user's original request.
- You have READ-ONLY MCP access. You CANNOT modify the photo.
- After each Editor iteration, inspect the latest artifact + current state, then send back a verdict.

WORKFLOW (every iteration):
1. Wait for an artifact from the Editor (a2a_subscribe_messages will return Editor's message when they publish).
2. Read the current state: get_photo_info, get_edit_state, get_histogram, get_screenshot.
3. Run analysis tools as needed:
   - analyze_exposure (zone system)
   - check_skin_tones (for portraits)
   - detect_clipping_map
   - analyze_color_harmony
   - analyze_local_contrast
   - get_dominant_colors
   - analyze_saturation_map
4. Score the image 0-10 on: a) intent match, b) technical quality, c) aesthetic quality.
5. If score >= 7 AND no major defects → send APPROVED verdict:
   a2a_send_message(to:'editor', text:'APPROVED. Score: 8/10. Reason: ...')
6. Otherwise → send REVISE verdict with specific actionable changes:
   a2a_send_message(to:'editor', text:JSON.stringify({
     verdict: 'revise',
     score: N,
     feedback: 'Highlights clipped on the snow by ~5%, skin looks too cool.',
     specific_changes: [
       { tool: 'set_adjustments', param: 'highlights', suggested_value: -25 },
       { tool: 'set_adjustments', param: 'temp', suggested_value: +8 },
     ]
   }))

REJECTION CRITERIA (be strict):
- Blown highlights / crushed shadows (>2% clipping).
- Skin tones shifted significantly from neutral skin-hue range.
- Over-saturation (overall saturation boost > +40).
- Unnatural color casts not justified by user request.
- Edits that ignore or contradict the user's stated intent.

TONE:
- Be specific and constructive. Cite numbers from your analysis tools.
- Don't nitpick — approve if the image is good enough.

You are communicating with: EDITOR (see their AgentCard for capabilities).
`;

// Every agent gets A2A tools. Editor also gets photo write tools. Reviewer
// only gets read tools. Lists use simple prefix matches.
const A2A_TOOLS = [
  'a2a_send_message',
  'a2a_subscribe_messages',
  'a2a_publish_artifact',
  'a2a_get_task',
];
const READ_ONLY_MCP_TOOLS = [
  'mcp__zenliro__get_',
  'mcp__zenliro__sample_',
  'mcp__zenliro__analyze_',
  'mcp__zenliro__measure_',
  'mcp__zenliro__estimate_',
  'mcp__zenliro__check_',
  'mcp__zenliro__detect_',
];

export const EDITOR_ROLE: AgentRole = {
  id: 'editor',
  label: 'Editor',
  colorHex: '#4d9fec',
  card: EDITOR_CARD,
  systemPrompt: EDITOR_SYSTEM_PROMPT,
  allowedMCPTools: [...A2A_TOOLS, 'mcp__zenliro__*'],
};

export const REVIEWER_ROLE: AgentRole = {
  id: 'reviewer',
  label: 'Reviewer',
  colorHex: '#68c98a',
  card: REVIEWER_CARD,
  systemPrompt: REVIEWER_SYSTEM_PROMPT,
  allowedMCPTools: [...A2A_TOOLS, ...READ_ONLY_MCP_TOOLS],
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
