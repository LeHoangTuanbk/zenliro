import { useMemo } from 'react';

type MarkdownTextProps = {
  text: string;
};

type Token =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'hr' }
  | { type: 'heading'; level: number; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'bullet'; content: string };

function tokenize(text: string): Token[] {
  const lines = text.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // HR
    if (/^---+$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|?$/.test(lines[i + 1].trim())) {
      const parseRow = (row: string) =>
        row.split('|').map((c) => c.trim()).filter((c) => c && !/^-+:?$/.test(c));
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    // Bullet
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (bulletMatch) {
      tokens.push({ type: 'bullet', content: bulletMatch[1] });
      i++;
      continue;
    }

    // Regular text line
    if (line.trim()) {
      tokens.push({ type: 'text', content: line });
    } else {
      tokens.push({ type: 'text', content: '' });
    }
    i++;
  }

  return tokens;
}

function InlineFormatted({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'bold' | 'italic' | 'code'; content: string }> = [];
    // Match **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      if (match[2]) result.push({ type: 'bold', content: match[2] });
      else if (match[4]) result.push({ type: 'italic', content: match[4] });
      else if (match[6]) result.push({ type: 'code', content: match[6] });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return result;
  }, [text]);

  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case 'bold':
            return <strong key={i} className="font-semibold text-[#e0e0e0]">{p.content}</strong>;
          case 'italic':
            return <em key={i} className="italic text-[#ccc]">{p.content}</em>;
          case 'code':
            return (
              <code key={i} className="px-1 py-0.5 bg-[#333] text-[#e8a854] rounded text-[10px] font-mono">
                {p.content}
              </code>
            );
          default:
            return <span key={i}>{p.content}</span>;
        }
      })}
    </>
  );
}

export function MarkdownText({ text }: MarkdownTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);

  return (
    <div className="text-[11px] leading-relaxed text-[#ddd] space-y-1.5">
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'hr':
            return <hr key={i} className="border-[#333] my-2" />;

          case 'heading':
            return (
              <p key={i} className={`font-semibold text-[#e0e0e0] ${
                token.level === 1 ? 'text-[13px]' : token.level === 2 ? 'text-[12px]' : 'text-[11px]'
              }`}>
                <InlineFormatted text={token.content} />
              </p>
            );

          case 'table':
            return (
              <div key={i} className="overflow-x-auto my-1.5">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr>
                      {token.headers.map((h, j) => (
                        <th key={j} className="text-left px-2 py-1 text-[#aaa] font-medium border-b border-[#333] bg-[#252525]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {token.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-2 py-1 text-[#ccc] border-b border-[#2a2a2a]">
                            <InlineFormatted text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'bullet':
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="text-[#666] mt-0.5">•</span>
                <span><InlineFormatted text={token.content} /></span>
              </div>
            );

          case 'text':
            if (!token.content) return <div key={i} className="h-1" />;
            return (
              <p key={i} className="whitespace-pre-wrap break-words">
                <InlineFormatted text={token.content} />
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
