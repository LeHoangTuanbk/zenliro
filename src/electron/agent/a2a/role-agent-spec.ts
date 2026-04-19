// CLI command + args builders for the two supported providers. Kept separate
// from RoleAgentManager so the runner stays focused on process lifecycle.
//
// Claude CLI: per-spawn `--system-prompt` + `--allowedTools` let each role
// have its own prompt and tool allowlist.
// Codex CLI: neither flag exists. The role's system prompt is prepended to
// the user prompt inline; tool restriction falls back to prompt-only guard
// (Codex's MCP tools are configured globally, not per-spawn).

import { CLAUDE_CLI } from '../const.js';
import type { AgentRole } from './roles.js';

export type CliSpec = { cmd: string; args: string[]; stdin?: string };

export function buildClaudeSpec(
  role: AgentRole,
  prompt: string,
  sessionId: string | null,
  model?: string,
): CliSpec {
  const args = [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    '--system-prompt',
    role.systemPrompt,
    '--allowedTools',
    role.allowedMCPTools.join(','),
    '--dangerously-skip-permissions',
  ];
  if (model) args.push('--model', model);
  if (sessionId) args.push('--resume', sessionId);
  args.push(prompt);
  return { cmd: CLAUDE_CLI, args };
}

export function buildCodexSpec(
  role: AgentRole,
  prompt: string,
  sessionId: string | null,
  model?: string,
): CliSpec {
  // Pass the prompt via stdin using the `-` marker. Our system prompts are
  // big (> 15KB with MULTI-AGENT overlays); passing a giant string as argv
  // is fragile (ARG_MAX, shell escaping quirks). Codex CLI's `exec` accepts
  // `-` to read instructions from stdin — cleaner and unbounded in size.
  const args = ['exec', '--json', '-s', 'danger-full-access', '--skip-git-repo-check'];
  if (model && model !== 'codex-default') args.push('-m', model);
  if (sessionId) {
    // Resume subcommand also reads from stdin when given `-`.
    args.push('resume', '--last', '-');
    return { cmd: 'codex', args, stdin: prompt };
  }
  args.push('-');
  return { cmd: 'codex', args, stdin: `${role.systemPrompt}\n\n---\n\n${prompt}` };
}
