import fs from 'fs';
import path from 'path';
import os from 'os';

export type ProviderModel = {
  id: string;
  label: string;
  description: string;
  provider: 'claude' | 'codex';
};

// Claude models — aliases are stable, full names change with versions
const CLAUDE_MODELS: ProviderModel[] = [
  { id: 'opus', label: 'Claude Opus', description: 'Most capable', provider: 'claude' },
  { id: 'sonnet', label: 'Claude Sonnet', description: 'Fast & capable', provider: 'claude' },
  { id: 'haiku', label: 'Claude Haiku', description: 'Fastest', provider: 'claude' },
];

function loadCodexModels(): ProviderModel[] {
  try {
    const cachePath = path.join(os.homedir(), '.codex', 'models_cache.json');
    if (!fs.existsSync(cachePath)) return [];

    const raw = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(raw);
    const models = data.models as Array<{
      slug: string;
      display_name?: string;
      description?: string;
      visibility?: string;
    }>;

    return models
      .filter((m) => m.visibility === 'list')
      .map((m) => ({
        id: m.slug,
        label: m.display_name ?? m.slug,
        description: m.description ?? '',
        provider: 'codex' as const,
      }));
  } catch {
    return [];
  }
}

export function loadAllModels(): ProviderModel[] {
  return [...CLAUDE_MODELS, ...loadCodexModels()];
}
