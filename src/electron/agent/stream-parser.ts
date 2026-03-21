export type ParsedStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; params: unknown }
  | { type: 'tool_result'; id: string }
  | { type: 'session_id'; sessionId: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export function parseStreamLine(line: string): ParsedStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const event = JSON.parse(trimmed);

    // System init — capture session ID
    if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
      return { type: 'session_id', sessionId: event.session_id };
    }

    // Assistant message — extract text from content blocks
    if (event.type === 'assistant' && event.message?.content) {
      const blocks = event.message.content;
      const textParts: string[] = [];
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id ?? '',
            name: block.name ?? '',
            params: block.input ?? {},
          };
        }
      }
      if (textParts.length > 0) {
        return { type: 'text', text: textParts.join('\n') };
      }
    }

    // Result — don't emit text again (already in assistant message)
    if (event.type === 'result') {
      if (event.is_error) {
        return { type: 'error', error: event.result ?? 'Unknown error' };
      }
      return { type: 'done' };
    }

    // Error event
    if (event.type === 'error') {
      return { type: 'error', error: event.error?.message ?? JSON.stringify(event) };
    }

    return null;
  } catch {
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
