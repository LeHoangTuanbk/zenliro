import { create } from 'zustand';

export type AgentMessageRole = 'user' | 'assistant';

export type AgentToolCall = {
  id: string;
  name: string;
  params: unknown;
  status: 'pending' | 'done' | 'error';
};

// Each stream item is either text or a tool call — rendered inline
export type StreamItem =
  | { type: 'text'; text: string }
  | { type: 'tool'; toolCall: AgentToolCall };

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  text: string;
  items?: StreamItem[];
  thinking?: string;
  timestamp: number;
};

export const AGENT_MODELS = [
  { id: 'opus', label: 'Claude Opus 4.6', tag: 'Best' },
  { id: 'sonnet', label: 'Claude Sonnet 4.6', tag: 'Fast' },
  { id: 'haiku', label: 'Claude Haiku 4.5', tag: 'Fastest' },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]['id'];

type AgentStore = {
  isOpen: boolean;
  isMaximized: boolean;
  isStreaming: boolean;
  isScanning: boolean;
  messages: AgentMessage[];
  currentItems: StreamItem[];
  currentThinking: string;
  actionToast: string | null;
  // Settings
  modelId: AgentModelId;
  fastMode: boolean;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMaximized: (max: boolean) => void;
  setStreaming: (v: boolean) => void;
  setScanning: (v: boolean) => void;
  setModelId: (id: AgentModelId) => void;
  toggleFastMode: () => void;

  addUserMessage: (text: string) => void;
  appendStreamText: (chunk: string) => void;
  setCurrentThinking: (text: string) => void;
  addToolCall: (tc: AgentToolCall) => void;
  finalizeAssistantMessage: () => void;
  clearMessages: () => void;
  showActionToast: (text: string) => void;
  hideActionToast: () => void;
};

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}`;

export const useAgentStore = create<AgentStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  isStreaming: false,
  isScanning: false,
  messages: [],
  currentItems: [],
  currentThinking: '',
  actionToast: null,
  modelId: 'sonnet',
  fastMode: true,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setScanning: (isScanning) => set({ isScanning }),
  setModelId: (modelId) => set({ modelId }),
  toggleFastMode: () => set((s) => ({ fastMode: !s.fastMode })),

  addUserMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', text, timestamp: Date.now() },
      ],
    })),

  appendStreamText: (chunk) =>
    set((s) => {
      const items = [...s.currentItems];
      const last = items[items.length - 1];
      // Append to existing text item or create new one
      if (last && last.type === 'text') {
        items[items.length - 1] = { type: 'text', text: last.text + chunk };
      } else {
        items.push({ type: 'text', text: chunk });
      }
      return { currentItems: items };
    }),

  setCurrentThinking: (currentThinking) => set({ currentThinking }),

  addToolCall: (tc) =>
    set((s) => ({
      // Flush any pending text, then add tool as separate item
      currentItems: [...s.currentItems, { type: 'tool', toolCall: tc }],
    })),

  finalizeAssistantMessage: () => {
    const s = get();
    if (s.currentItems.length === 0) return;

    // Build full text from text items
    const fullText = s.currentItems
      .filter((i): i is StreamItem & { type: 'text' } => i.type === 'text')
      .map((i) => i.text)
      .join('');

    set({
      messages: [
        ...s.messages,
        {
          id: nextId(),
          role: 'assistant',
          text: fullText,
          items: [...s.currentItems],
          thinking: s.currentThinking || undefined,
          timestamp: Date.now(),
        },
      ],
      currentItems: [],
      currentThinking: '',
    });
  },

  clearMessages: () => set({ messages: [], currentItems: [], currentThinking: '' }),

  showActionToast: (text) => {
    set({ actionToast: text });
    setTimeout(() => {
      if (get().actionToast === text) set({ actionToast: null });
    }, 2000);
  },

  hideActionToast: () => set({ actionToast: null }),
}));
