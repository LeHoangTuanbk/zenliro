import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownTextProps = {
  text: string;
};

const components: Components = {
  h1: ({ children }) => <p className="font-semibold text-[13px] text-[#e0e0e0]">{children}</p>,
  h2: ({ children }) => <p className="font-semibold text-[12px] text-[#e0e0e0]">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-[11px] text-[#e0e0e0]">{children}</p>,
  hr: () => <hr className="border-[#333] my-2" />,
  p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[#e0e0e0]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[#ccc]">{children}</em>,
  code: ({ children }) => <code className="text-[#b0b0b0]">{children}</code>,
  ul: ({ children }) => <ul className="space-y-0.5 pl-1">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-1.5">
      <span className="text-[#666] mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-1.5">
      <table className="w-full text-[10px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="text-left px-2 py-1 text-[#aaa] font-medium border-b border-[#333] bg-[#252525]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 text-[#ccc] border-b border-[#2a2a2a]">{children}</td>
  ),
};

export function MarkdownText({ text }: MarkdownTextProps) {
  return (
    <div className="text-[11px] leading-relaxed text-[#ddd] space-y-1.5">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>{text}</Markdown>
    </div>
  );
}
