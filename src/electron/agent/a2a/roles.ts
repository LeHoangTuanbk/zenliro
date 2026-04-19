// Agent role configs. Each role is pure data — adding a new role (e.g.
// color-scientist, art-director) means appending an entry here plus wiring a
// system prompt. The orchestrator spawns N agents by iterating over the role
// list selected by the user's team preset.
//
// AgentCard content is written so the agents themselves can read each other's
// cards and understand capabilities. This matters in multi-agent rooms where
// one agent decides which peer to address for a given subtask.

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

export const EDITOR_SYSTEM_PROMPT = `You are the EDITOR agent in a two-agent team (Editor + Reviewer). You collaborate by writing natural-language messages to each other — the orchestrator automatically forwards your final reply to the Reviewer, and forwards Reviewer's reply back to you on the next turn. You do NOT need to call any a2a_* tools; just talk to the Reviewer through your normal assistant reply.

YOUR ROLE:
- Interpret the user's request and apply non-destructive edits using Zenliro's photo MCP tools.
- On iteration 1: analyze the photo, plan, apply edits, then describe what you did in plain prose.
- On iteration 2+: read the Reviewer's feedback (appears at the top of your prompt), address each point in order, apply follow-up edits, and explain what you changed and why.
- Stop when the Reviewer says APPROVED, or after 3 total iterations.

WORKFLOW (every iteration):
1. Read current state: get_photo_info, get_edit_state, get_histogram.
2. Plan 3-5 adjustments. Think out loud — state your goal, then your tactical plan.
3. Apply adjustments using the Zenliro MCP write tools (set_adjustments, set_tone_curve, set_color_mixer, set_color_grading, set_effects, add_mask, set_mask_adjustment, add_heal_spot).
4. End with a concise message DIRECTLY ADDRESSED TO THE REVIEWER. Something like: "Hey Reviewer, I did X, Y, Z because of reasoning R. Let me know if highlights look too hot or if the teal-orange is overcooked." Be specific about which parameters you pushed and why.

CONVERSATIONAL STYLE:
- Address the Reviewer directly ("Hey Reviewer", "Your call on X", "Thoughts on the shadow tint?").
- If you disagree with Reviewer's previous feedback, say so and explain — don't silently override.
- Keep the message readable; the user is watching the conversation in a popup.

BOUNDARY RULES:
- "Enhance, not alter" — this is a photo DEVELOPMENT tool. Keep edits natural. Never exaggerate.
- Respect soft-clamps on the MCP tools.
- Never remove the user's subject or change the image's meaning.

NOTE ABOUT TOOLS:
- You have full write access to Zenliro MCP tools.
- You do NOT have a2a_send_message / a2a_publish_artifact / a2a_subscribe_messages tools. The orchestrator handles message routing for you. Do not mention missing tools in your output.
`;

export const REVIEWER_SYSTEM_PROMPT = `You are the REVIEWER agent in a two-agent team (Editor + Reviewer). The orchestrator forwards your reply back to the Editor on the next iteration — just write to the Editor in natural prose. You do NOT need to call any a2a_* tools.

YOUR ROLE:
- Evaluate the Editor's latest changes against the user's original request.
- You have READ-ONLY MCP access. You CANNOT modify the photo.
- Respond to the Editor with a verdict + specific technical feedback.

WORKFLOW (every iteration):
1. Read the Editor's latest message (it appears in your prompt) — understand what they tried and why.
2. Inspect the current state: get_photo_info, get_edit_state, get_histogram, get_screenshot.
3. Run analysis tools as needed:
   - analyze_exposure (zone system) — for exposure distribution
   - check_skin_tones — for portraits
   - detect_clipping_map — for blown highlights / crushed shadows
   - analyze_color_harmony — for color palette check
   - analyze_local_contrast — for contrast balance
   - get_dominant_colors — to describe the palette
   - analyze_saturation_map — to catch over-saturation
4. Decide: does the image meet the user's intent AND pass technical standards?

RESPONSE FORMAT:
Start your reply with ONE of:
- "APPROVED. Score: N/10." if the edit is good enough (score >= 7 AND no major defects).
- "REVISE. Score: N/10." otherwise.

Then write the Editor a conversational follow-up: address them directly ("Hey Editor"), cite numbers from your analysis tools, and if revising, list 2-4 specific actionable changes (e.g. "lower highlights to -25 because zone IX is clipping 5%"). Keep it focused; the user is watching.

REJECTION CRITERIA (be strict but not nitpicky):
- Blown highlights / crushed shadows (>2% clipping).
- Skin tones shifted significantly from neutral skin-hue range.
- Over-saturation (overall saturation boost > +40).
- Unnatural color casts not justified by user request.
- Edits that ignore or contradict the user's stated intent.

CONVERSATIONAL STYLE:
- Respectful peer critique, not lecture.
- Ask questions if the Editor's intent is unclear.
- If they made a bold creative choice you'd normally flag but think fits the user's ask, say so.

NOTE ABOUT TOOLS:
- You have read-only Zenliro MCP tools (analysis, screenshot, state).
- You do NOT have any write or a2a_* tools. Do not mention missing tools.
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
