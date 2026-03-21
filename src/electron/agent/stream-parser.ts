export type ParsedStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; params: unknown }
  | { type: 'tool_result'; id: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export function parseStreamLine(line: string): ParsedStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed);

    if (event.type === 'assistant' && event.message) {
      // Full assistant message at end of turn
      const blocks = event.message.content ?? [];
      const textParts: string[] = [];
      for (const block of blocks) {
        if (block.type === 'text') textParts.push(block.text);
      }
      if (textParts.length > 0) {
        return { type: 'text', text: textParts.join('\n') };
      }
    }

    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        return { type: 'text', text: delta.text };
      }
      if (delta?.type === 'thinking_delta' && delta.thinking) {
        return { type: 'thinking', text: delta.thinking };
      }
    }

    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block?.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id ?? '',
          name: block.name ?? '',
          params: block.input ?? {},
        };
      }
    }

    if (event.type === 'content_block_stop') {
      // tool result is implicit — the CLI handles tool execution
    }

    if (event.type === 'result') {
      return { type: 'done' };
    }

    if (event.type === 'error') {
      return { type: 'error', error: event.error?.message ?? 'Unknown error' };
    }

    return null;
  } catch {
    // Not JSON — might be raw text output
    return null;
  }
}

export class StreamLineBuffer {
  private buffer = '';

  feed(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines;
  }

  flush(): string[] {
    if (!this.buffer) return [];
    const line = this.buffer;
    this.buffer = '';
    return [line];
  }
}
