import { create } from 'zustand';

export type AgentMessageRole = 'user' | 'assistant';

export type AgentToolCall = {
  id: string;
  name: string;
  params: unknown;
  status: 'pending' | 'done' | 'error';
};

// Each stream item is either text or a tool call — rendered inline
export type StreamItem = { type: 'text'; text: string } | { type: 'tool'; toolCall: AgentToolCall };

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  text: string;
  items?: StreamItem[];
  thinking?: string;
  timestamp: number;
};

export type AgentProvider = 'claude' | 'codex';

export type AgentModel = {
  id: string;
  label: string;
  description: string;
  provider: AgentProvider;
};

// Fallback models until dynamic load completes
export const DEFAULT_MODELS: AgentModel[] = [
  { id: 'opus', label: 'Claude Opus', description: 'Most capable', provider: 'claude' },
  { id: 'sonnet', label: 'Claude Sonnet', description: 'Fast & capable', provider: 'claude' },
  { id: 'haiku', label: 'Claude Haiku', description: 'Fastest', provider: 'claude' },
];

export type AgentModelId = string;

type ChatHistoryEntry = {
  id: string;
  title: string;
  updatedAt: number;
};

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
  models: AgentModel[];
  modelsLoaded: boolean;
  modelId: AgentModelId;
  provider: AgentProvider;
  fastMode: boolean;
  // Chat session
  chatId: string | null;
  chatTitle: string;
  chatHistoryList: ChatHistoryEntry[];
  showChatHistory: boolean;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMaximized: (max: boolean) => void;
  setStreaming: (v: boolean) => void;
  setScanning: (v: boolean) => void;
  setModelId: (id: AgentModelId, provider: AgentProvider) => void;
  loadModels: (models: AgentModel[]) => void;
  toggleFastMode: () => void;

  addUserMessage: (text: string) => void;
  appendStreamText: (chunk: string) => void;
  setCurrentThinking: (text: string) => void;
  addToolCall: (tc: AgentToolCall) => void;
  finalizeAssistantMessage: () => void;
  clearMessages: () => void;
  showActionToast: (text: string) => void;
  hideActionToast: () => void;

  // Chat history
  newChat: () => void;
  saveCurrentChat: () => void;
  loadChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  loadChatHistoryList: () => Promise<void>;
  setShowChatHistory: (v: boolean) => void;
  setChatTitle: (title: string) => void;
};

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}`;

function generateChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function placeholderTitle(text: string): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  return cleaned.length > 50 ? cleaned.slice(0, 50) + '...' : cleaned;
}

async function generateAITitle(userMsg: string, assistantMsg: string): Promise<string> {
  try {
    console.log('[agent-store] Requesting AI title generation...');
    const title = await window.electron?.agent?.generateTitle(userMsg, assistantMsg);
    console.log('[agent-store] AI title result:', title);
    return title || placeholderTitle(userMsg);
  } catch (err) {
    console.warn('[agent-store] AI title generation failed:', err);
    return placeholderTitle(userMsg);
  }
}

const SAVE_DEBOUNCE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveChat(store: () => AgentStore) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = store();
    if (!s.chatId || s.messages.length === 0) return;
    window.electron?.chatHistory?.save({
      id: s.chatId,
      title: s.chatTitle,
      messages: s.messages,
      updatedAt: Date.now(),
    });
  }, SAVE_DEBOUNCE_MS);
}

const STORAGE_KEY = 'zenliro-agent-model';

function loadSavedModel(): { modelId: string; provider: AgentProvider } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.modelId && saved.provider) return saved;
    }
  } catch {
    /* ignore */
  }
  return { modelId: 'opus', provider: 'claude' };
}

function saveModel(modelId: string, provider: AgentProvider) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modelId, provider }));
  } catch {
    /* ignore */
  }
}

const savedModel = loadSavedModel();

export const useAgentStore = create<AgentStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  isStreaming: false,
  isScanning: false,
  messages: [],
  currentItems: [],
  currentThinking: '',
  actionToast: null,
  models: DEFAULT_MODELS,
  modelsLoaded: false,
  modelId: savedModel.modelId,
  provider: savedModel.provider,
  fastMode: true,
  chatId: null,
  chatTitle: '',
  chatHistoryList: [],
  showChatHistory: false,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setScanning: (isScanning) => set({ isScanning }),
  setModelId: (modelId, provider) => {
    saveModel(modelId, provider);
    set({ modelId, provider });
  },
  loadModels: (models) => set({ models, modelsLoaded: true }),
  toggleFastMode: () => set((s) => ({ fastMode: !s.fastMode })),

  addUserMessage: (text) =>
    set((s) => {
      const isFirst = s.messages.length === 0;
      const chatId = s.chatId ?? generateChatId();
      const chatTitle = isFirst ? placeholderTitle(text) : s.chatTitle;
      return {
        chatId,
        chatTitle,
        messages: [...s.messages, { id: nextId(), role: 'user', text, timestamp: Date.now() }],
      };
    }),

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
    set((s) => {
      // If tool with same id already exists (e.g. item.started → item.completed), update it
      const existing = s.currentItems.findIndex(
        (item) => item.type === 'tool' && item.toolCall.id === tc.id,
      );
      if (existing >= 0) {
        const items = [...s.currentItems];
        items[existing] = { type: 'tool', toolCall: tc };
        return { currentItems: items };
      }
      return { currentItems: [...s.currentItems, { type: 'tool', toolCall: tc }] };
    }),

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

    // Generate AI title after first assistant response
    const updated = get();
    const userMsgs = updated.messages.filter((m) => m.role === 'user');
    const assistantMsgs = updated.messages.filter((m) => m.role === 'assistant');
    if (userMsgs.length === 1 && assistantMsgs.length === 1) {
      generateAITitle(userMsgs[0].text, assistantMsgs[0].text).then((title) => {
        const current = get();
        // Only update if still on the same chat
        if (current.chatId === updated.chatId) {
          set({ chatTitle: title });
          debouncedSaveChat(get);
        }
      });
    }

    // Auto-save after assistant finishes
    debouncedSaveChat(get);
  },

  clearMessages: () => {
    // Save current chat before clearing
    const s = get();
    if (s.chatId && s.messages.length > 0) {
      window.electron?.chatHistory?.save({
        id: s.chatId,
        title: s.chatTitle,
        messages: s.messages,
        updatedAt: Date.now(),
      });
    }
    set({
      messages: [],
      currentItems: [],
      currentThinking: '',
      chatId: null,
      chatTitle: '',
    });
  },

  showActionToast: (text) => {
    set({ actionToast: text });
    setTimeout(() => {
      if (get().actionToast === text) set({ actionToast: null });
    }, 2000);
  },

  hideActionToast: () => set({ actionToast: null }),

  // Chat history
  newChat: () => {
    const s = get();
    if (s.chatId && s.messages.length > 0) {
      window.electron?.chatHistory?.save({
        id: s.chatId,
        title: s.chatTitle,
        messages: s.messages,
        updatedAt: Date.now(),
      });
    }
    set({
      messages: [],
      currentItems: [],
      currentThinking: '',
      chatId: null,
      chatTitle: '',
      showChatHistory: false,
    });
  },

  saveCurrentChat: () => {
    const s = get();
    if (!s.chatId || s.messages.length === 0) return;
    window.electron?.chatHistory?.save({
      id: s.chatId,
      title: s.chatTitle,
      messages: s.messages,
      updatedAt: Date.now(),
    });
  },

  loadChat: async (chatId) => {
    const data = await window.electron?.chatHistory?.load(chatId);
    if (!data) return;
    const session = data as ChatSession;
    msgCounter = session.messages.length;
    set({
      chatId: session.id,
      chatTitle: session.title,
      messages: session.messages as AgentMessage[],
      currentItems: [],
      currentThinking: '',
      showChatHistory: false,
    });
  },

  deleteChat: async (chatId) => {
    await window.electron?.chatHistory?.delete(chatId);
    const s = get();
    set({
      chatHistoryList: s.chatHistoryList.filter((c) => c.id !== chatId),
    });
    // If we deleted the active chat, reset
    if (s.chatId === chatId) {
      set({
        messages: [],
        currentItems: [],
        currentThinking: '',
        chatId: null,
        chatTitle: '',
      });
    }
  },

  loadChatHistoryList: async () => {
    const list = await window.electron?.chatHistory?.list();
    if (list) set({ chatHistoryList: list });
  },

  setShowChatHistory: (showChatHistory) => {
    set({ showChatHistory });
    if (showChatHistory) get().loadChatHistoryList();
  },

  setChatTitle: (chatTitle) => set({ chatTitle }),
}));
