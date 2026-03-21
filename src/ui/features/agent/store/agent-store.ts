import { create } from 'zustand';

export type AgentMessageRole = 'user' | 'assistant';

export type AgentToolCall = {
  id: string;
  name: string;
  params: unknown;
  status: 'pending' | 'done' | 'error';
};

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  text: string;
  toolCalls?: AgentToolCall[];
  thinking?: string;
  timestamp: number;
};

type AgentStore = {
  isOpen: boolean;
  isMaximized: boolean;
  isStreaming: boolean;
  isScanning: boolean;
  messages: AgentMessage[];
  currentStreamText: string;
  currentToolCalls: AgentToolCall[];
  currentThinking: string;
  actionToast: string | null;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMaximized: (max: boolean) => void;
  setStreaming: (v: boolean) => void;
  setScanning: (v: boolean) => void;

  addUserMessage: (text: string) => void;
  appendStreamText: (chunk: string) => void;
  setCurrentThinking: (text: string) => void;
  addToolCall: (tc: AgentToolCall) => void;
  updateToolCallStatus: (id: string, status: AgentToolCall['status']) => void;
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
  currentStreamText: '',
  currentToolCalls: [],
  currentThinking: '',
  actionToast: null,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setScanning: (isScanning) => set({ isScanning }),

  addUserMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', text, timestamp: Date.now() },
      ],
    })),

  appendStreamText: (chunk) =>
    set((s) => ({ currentStreamText: s.currentStreamText + chunk })),

  setCurrentThinking: (currentThinking) => set({ currentThinking }),

  addToolCall: (tc) =>
    set((s) => ({ currentToolCalls: [...s.currentToolCalls, tc] })),

  updateToolCallStatus: (id, status) =>
    set((s) => ({
      currentToolCalls: s.currentToolCalls.map((tc) =>
        tc.id === id ? { ...tc, status } : tc,
      ),
    })),

  finalizeAssistantMessage: () => {
    const s = get();
    if (!s.currentStreamText && s.currentToolCalls.length === 0) return;
    set({
      messages: [
        ...s.messages,
        {
          id: nextId(),
          role: 'assistant',
          text: s.currentStreamText,
          toolCalls: s.currentToolCalls.length > 0 ? [...s.currentToolCalls] : undefined,
          thinking: s.currentThinking || undefined,
          timestamp: Date.now(),
        },
      ],
      currentStreamText: '',
      currentToolCalls: [],
      currentThinking: '',
    });
  },

  clearMessages: () => set({ messages: [] }),

  showActionToast: (text) => {
    set({ actionToast: text });
    setTimeout(() => {
      if (get().actionToast === text) set({ actionToast: null });
    }, 2000);
  },

  hideActionToast: () => set({ actionToast: null }),
}));
