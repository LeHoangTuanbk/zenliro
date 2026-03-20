import { useState, useCallback } from 'react';
import { X } from 'lucide-react';

type TagEditorProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const [input, setInput] = useState('');

  const addTag = useCallback(() => {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
  }, [input, tags, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  }, [tags, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-[#3a3a3a] text-[#f2f2f2] rounded-[2px]"
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-400 cursor-pointer">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Add tag..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(); }
        }}
        className="px-2 py-1 text-[10px] bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] text-[#f2f2f2] outline-none focus:border-[#4d9fec] placeholder:text-br-dim w-full"
      />
    </div>
  );
}
