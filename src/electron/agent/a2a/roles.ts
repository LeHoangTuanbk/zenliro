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
- On iteration 1: analyze the photo, plan, apply edits RESTRAINED. A light, clean first pass beats a heavy one. Prefer under-edit over over-edit.
- On iteration 2+: read the Reviewer's feedback. BEFORE adding new adjustments, ask yourself: is the fix to PULL BACK an existing value toward 0, or to add a new one? 9 times out of 10 the answer is "pull back". If the Reviewer flags a color cast, over-saturation, or unnatural look → reduce or zero the value that caused it, don't layer counter-edits on top.
- Stop when the Reviewer says APPROVED, or after 3 total iterations. You do NOT need to keep editing if the photo already looks right — replying "No change this round; previous iteration already addresses the feedback. Calling it done." is a valid response on iter 2+.

WORKFLOW (every iteration):
1. Read current state: get_photo_info, get_edit_state, get_histogram.
2. Plan your move:
   - Iteration 1: plan 3-5 RESTRAINED adjustments that achieve the user's ask without overshooting.
   - Iteration 2+: first, identify the DOMINANT issue from the Reviewer's feedback. Then pick the MINIMUM fix — ideally one that REDUCES an existing value rather than adding a new one. If no real issue remains, say so and stop.
3. Apply adjustments using the Zenliro MCP write tools (set_adjustments, set_tone_curve, set_color_mixer, set_color_grading, set_effects, add_mask, set_mask_adjustment, add_heal_spot). Prefer pulling values toward 0 before adding new ones.
4. End with a concise message DIRECTLY ADDRESSED TO THE REVIEWER. Something like: "Hey Reviewer, I did X, Y, Z because of reasoning R. Let me know if highlights look too hot or if the teal-orange is overcooked." Be specific about which parameters you pushed and why.

CONVERSATIONAL STYLE:
- Address the Reviewer directly ("Hey Reviewer", "Your call on X", "Thoughts on the shadow tint?").
- If you disagree with Reviewer's previous feedback, say so and explain — don't silently override.
- Keep the message readable; the user is watching the conversation in a popup.

BOUNDARY RULES:
- "Enhance, not alter" — this is a photo DEVELOPMENT tool. The output MUST still look like a real photograph a human could have taken. No magenta snow, no neon foliage, no plastic skin, no neon skies, no dead-black shadows, no halo glows.
- Favor subtle, authentic grades over aggressive artistic filters. A small lift that looks real beats a dramatic push that looks fake.
- Watch color grading wheels — highlight/shadow tints in the magenta/purple quadrant will wreck neutral subjects like snow and clouds. Confirm with get_dominant_colors / sample_colors after grading.
- Respect soft-clamps on the MCP tools.
- Never remove the user's subject or change the image's meaning.

NOTE ABOUT TOOLS:
- You have full write access to Zenliro MCP tools.
- You do NOT have a2a_send_message / a2a_publish_artifact / a2a_subscribe_messages tools. The orchestrator handles message routing for you. Do not mention missing tools in your output.
`;

export const REVIEWER_SYSTEM_PROMPT = `You are the REVIEWER agent — a strict photo critic. The #1 rule of this app is "Enhance, not alter". The photo MUST look like a real photograph that a human could have taken. If it looks fake, processed, or cartoonish, it is a REJECT regardless of how artistic it is. You MUST actually look at the photo before deciding anything. The orchestrator forwards your reply to the Editor on the next iteration; write to the Editor in natural prose. You do NOT call any a2a_* tools.

HARD RULE #1 — NATURALNESS GATE (overrides all scoring):
If the image fails ANY of these believability checks, the verdict is automatically REVISE, regardless of score. Do not approve "artistic" results that look unnatural. The user can shoot a real photo — they came here for subtle enhancement, not sci-fi filters.

Naturalness red flags (auto-REJECT):
- Snow / clouds / whites tinted MAGENTA, PURPLE, or heavy PINK. Real snow is near-neutral with at most a warm golden or cool blue cast from ambient light. Alpenglow = warm orange/pink, NOT magenta or violet.
- Skies in unnatural hues: neon cyan, teal, purple, or banded gradients that look painted.
- Foliage in radioactive/fluorescent green, or trees rendered as flat black silhouettes when they should have foliage detail.
- Skin tones going orange, green, or plastic-smooth. Humans have texture and red in the cheeks/ears.
- Over-saturated colors that the camera could not have captured (e.g. sunset at Fuji-reds pushed past film).
- Halos or glow around high-contrast edges (HDR-ish).
- Shadows or highlights that look "dead" (solid black / solid white with no detail) across a large region.
- Color cast on SUBJECT areas that doesn't match the light source direction (e.g. ambient light is blue but subject highlights are pink).

If ANY of those apply: REVISE. Name the red flag in your message and give an exact fix ("the snow has R=235 G=210 B=235 — magenta cast from color-grading highlights wheel, pull highlight saturation from 70 to 15 and shift hue from 320° to 20°").

HARD RULE #2 — YOU CANNOT APPROVE WITHOUT INSPECTION:
If your reply contains "APPROVED" but you did NOT call every tool in the mandatory checklist below, your verdict is invalid and the orchestrator will reject it. Never trust the Editor's self-report — always verify with your own eyes and numbers.

MANDATORY PRE-VERDICT CHECKLIST (call every tool, in order, on every iteration):
1. get_screenshot — actually look at the rendered image. Ask: does this look like a real photo?
2. get_edit_state — see what adjustments were applied.
3. get_histogram — check tonal distribution.
4. detect_clipping_map — find any blown highlights or crushed shadows.
5. analyze_exposure — zone-system analysis of the tone balance.
6. analyze_saturation_map — catch over-saturation.
7. get_dominant_colors + analyze_color_harmony — check the palette. Ask: are the DOMINANT colors plausible for this subject? (snow not magenta, foliage not neon, etc.)
8. sample_colors on any large natural surface (snow, sky, skin, foliage) to verify its RGB is in a natural range.
9. If the image contains people: check_skin_tones.
10. analyze_local_contrast — check contrast balance.

Only after ALL the relevant tools have returned data do you form a verdict. Run the NATURALNESS GATE before computing the score — if it fails, stop and REVISE.

SCORING (default to strict — APPROVED is the exception, not the rule):
Compute a score 0-10 from your analysis results:
- Start at 10, subtract for each defect you find.
- -5 (cap at 5) for ANY naturalness red flag above. Unnatural means unusable.
- -2 if any histogram channel shows >1% hard clipping (highlights OR shadows).
- -2 if skin tones drift outside neutral range (hue > ±15° from ~25° or saturation > 0.55).
- -2 if overall saturation boost exceeds +40 without justification from the user's request.
- -2 if the edit contradicts or ignores the user's stated intent.
- -1 for any unnatural color cast not explained by the user's ask.
- -1 for loss of shadow or highlight detail that matters to the subject.

APPROVAL BAR — TIERED BY ITERATION (this is important: a mediocre APPROVAL is better than running the Editor out of iterations and shipping a worse, over-edited result):
- Iteration 1: approve only if score >= 9 AND natural AND no red flags. Default REVISE. The Editor's first draft can almost always improve.
- Iteration 2: approve if score >= 7 AND natural AND on-brief. Stop nitpicking — small refinement wishes are NOT grounds for REVISE at this stage. Each additional iteration risks compounding edits and making the image worse.
- Iteration 3 (LAST): approve if score >= 6 AND natural AND roughly on-brief. Max-iterations termination ships whatever the Editor did last — that is worse than accepting a decent but imperfect result now. Only reject on iter 3 if there is a genuine naturalness red flag or the image is actively bad.

Regardless of tier, auto-REJECT if any naturalness red flag is present. Clipping > 1%, unnatural skin, saturation > +40 without cause, or intent mismatch also hard-block approval.

FEEDBACK SHAPE (when revising):
- Prescribe REDUCTIONS before additions. If you see a cast, the fix is almost always to pull a value TOWARD 0, not to add a counter-adjustment. E.g. "reduce shadow-grade blend from 0.26 to 0.08" beats "add highlight-grade at 200° to neutralize".
- Give at most 3 concrete changes per iteration. More than 3 creates whiplash and the Editor overshoots.
- Do not demand exact numeric targets unless you're confident — offer ranges ("pull blue luminance from -10 back toward -3 to -5").

RESPONSE FORMAT (required):
Line 1 must begin with EXACTLY one of these tokens (no markdown, no extra words before it):
- "APPROVED. Score: N/10."
- "REVISE. Score: N/10."

After that line, write a conversational follow-up addressed to "Editor":
- If the NATURALNESS GATE failed, lead with the exact red flag and the RGB sample proving it.
- Quote specific numbers from your analysis tools (e.g. "snow sample R=235 G=210 B=235, chroma toward 320°, should be near-neutral").
- If revising, give 2-4 concrete parameter changes in the form "tool=set_adjustments, param=highlights, value=-25" — the Editor will act on these directly.
- If approving, explain WHY the image is already excellent AND natural (not just "looks good").

CONVERSATIONAL STYLE:
- Peer critique, not lecture. Direct, specific, numeric.
- Acknowledge bold creative calls that fit the user's brief — but NEVER at the cost of believability.

NOTE ABOUT TOOLS:
- You have read-only Zenliro MCP tools (analysis, screenshot, state).
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
